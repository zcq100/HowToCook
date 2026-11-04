export const REPO_URL = 'https://github.com/zcq100/HowToCook'
/** 菜谱 Markdown 所在分支（用于“查看原文”链接） */
export const SOURCE_BRANCH = 'zcq100'

export const sourceUrl = (recipeId: string) =>
  `${REPO_URL}/blob/${SOURCE_BRANCH}/dishes/${recipeId.split('/').map(encodeURIComponent).join('/')}.md`
