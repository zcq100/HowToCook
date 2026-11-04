# 菜谱蓝图 web 版容器镜像
#
# 构建（在仓库根目录执行，构建上下文需要包含 dishes/ 和 web/）：
#   docker build -f web/Dockerfile -t howtocook-web .
# 运行：
#   docker run --rm -p 8080:8080 howtocook-web     # http://localhost:8080
#
# 多阶段构建：第一阶段用 Node 生成静态文件，最终镜像只有 static-web-server（scratch 基础，约 8MB）+ 静态文件。
# 注意：容器内只是静态站点。每道菜的链接预览（/r/<菜谱> 的 meta 改写）由 Cloudflare Worker 提供，容器里没有；
# 但 /r/<菜谱> 链接本身可以正常打开（回退到 index.html，前端再跳到对应菜谱）。

# ---- 构建阶段：固定在构建机架构上运行，产物与架构无关，多架构镜像无需模拟器 ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY dishes /src/dishes
COPY web ./
RUN npm run build

# ---- 运行阶段 ----
FROM docker.io/joseluisq/static-web-server:2
COPY --from=build /src/web/dist /public
COPY web/container/sws.toml /sws.toml
# 端口、根目录、回退页、缓存头等全部在 sws.toml 中配置
ENV SERVER_CONFIG_FILE=/sws.toml
# 以非 root 用户运行（scratch 镜像没有用户表，直接用数字 UID）
USER 65534:65534
EXPOSE 8080
