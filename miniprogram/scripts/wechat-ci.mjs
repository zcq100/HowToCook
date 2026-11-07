import fs from 'node:fs'
import path from 'node:path'
import { createPrivateKey } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Node 25 exposes an incomplete localStorage without a backing file. The
// official compiler assumes the browser storage API when it sees this global.
// Reexec so compiler subprocesses inherit the same compatibility flag.
if (Number(process.versions.node.split('.')[0]) >= 25 && !process.execArgv.includes('--no-experimental-webstorage')) {
  const child = spawnSync(process.execPath, ['--no-experimental-webstorage', ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' })
  if (child.error) console.error(child.error.message)
  process.exit(child.status ?? 1)
}

const root = fileURLToPath(new URL('../', import.meta.url))
const mode = process.argv[2] || 'check'
const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const keyPath = path.resolve(root, process.env.WECHAT_PRIVATE_KEY_PATH || `.secrets/private.${config.appid}.key`)
const artifactDir = path.join(root, 'artifacts')

async function main() {
  if (!['check', 'preview', 'upload'].includes(mode)) throw new Error('Usage: wechat-ci.mjs check|preview|upload')
  if (!/^wx[0-9a-f]{16}$/.test(config.appid)) throw new Error('请配置有效的微信小程序 AppID')
  const app = path.join(root, config.miniprogramRoot, 'app.json')
  if (!fs.existsSync(app)) throw new Error('缺少构建产物，请先执行 npm run build')
  console.log(`AppID: ${config.appid}`)
  if (!fs.existsSync(keyPath)) throw new Error(`尚未配置代码上传密钥。请保存到 ${keyPath}，或设置 WECHAT_PRIVATE_KEY_PATH。需要的是代码上传密钥文件，不是 AppSecret。`)
  // Validate locally without printing key material or sending it anywhere.
  createPrivateKey(fs.readFileSync(keyPath))
  console.log('本地构建和密钥格式检查通过；后台 IP 白名单及账号权限将在请求时由微信验证。')
  if (mode === 'check') return
  const { default: ci } = await import('miniprogram-ci')
  const project = new ci.Project({
    appid: config.appid,
    type: 'miniProgram',
    projectPath: root,
    privateKeyPath: keyPath,
    ignores: ['node_modules/**/*', '.secrets/**/*', 'artifacts/**/*', 'preview/**/*', 'scripts/**/*', 'src/**/*', 'build/**/*'],
  })
  const options = {
    project,
    desc: process.env.WECHAT_DESCRIPTION || '原生菜谱小程序验证版',
    setting: { useProjectConfig: true },
    threads: 2,
    onProgressUpdate: progress => { if (progress?.message) console.log(progress.message) },
  }
  if (mode === 'preview') {
    fs.mkdirSync(artifactDir, { recursive: true })
    const qrcodeOutputDest = path.join(artifactDir, 'preview.jpg')
    // Remove an old code so a failed request cannot leave a misleading preview.
    fs.rmSync(qrcodeOutputDest, { force: true })
    await ci.preview({ ...options, qrcodeFormat: 'image', qrcodeOutputDest, pagePath: 'pages/index/index' })
    console.log(`手机微信扫码预览：${qrcodeOutputDest}`)
  } else {
    const version = process.env.WECHAT_VERSION
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('上传需指定 WECHAT_VERSION，例如 0.1.0')
    await ci.upload({ ...options, version })
    console.log(`开发版本 ${version} 上传成功。可在微信后台设为体验版；此命令不会提交审核或正式发布。`)
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
