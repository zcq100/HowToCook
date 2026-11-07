import type { Recipe } from '../../../packages/recipe-core/types'
import { recipes } from '../data/recipes'

export type Summary = Pick<Recipe, 'id' | 'name' | 'category' | 'categoryName' | 'difficulty' | 'description' | 'cover'>
export interface Category { id: string; name: string; count: number }
export interface Query { category?: string; q?: string; cursor?: string; limit?: number }
export interface RecipeRepository {
  listCategories(): Promise<Category[]>
  listRecipes(query: Query): Promise<{ items: Summary[]; nextCursor: string | null; total: number }>
  getRecipe(id: string): Promise<Recipe>
}

export const repository: RecipeRepository = {
  async listCategories() {
    const categories = new Map<string, Category>()
    for (const recipe of recipes) {
      const category = categories.get(recipe.category) || { id: recipe.category, name: recipe.categoryName, count: 0 }
      category.count++
      categories.set(category.id, category)
    }
    return [...categories.values()]
  },
  async listRecipes({ category, q = '', cursor, limit = 20 }) {
    const keyword = q.trim().toLocaleLowerCase()
    const filtered = recipes.filter(recipe => (!category || recipe.category === category) &&
      (!keyword || [recipe.name, recipe.categoryName, ...recipe.ingredients.map(i => i.name)].join(' ').toLocaleLowerCase().includes(keyword)))
    const offset = Number(cursor || 0)
    if (!Number.isInteger(offset) || offset < 0) throw new Error('无效的分页位置')
    const size = Math.min(50, Math.max(1, limit))
    const items = filtered.slice(offset, offset + size).map(({ id, name, category, categoryName, difficulty, description, cover }) =>
      ({ id, name, category, categoryName, difficulty, description, cover }))
    return { items, total: filtered.length, nextCursor: offset + size < filtered.length ? String(offset + size) : null }
  },
  async getRecipe(id) {
    const recipe = recipes.find(recipe => recipe.id === id)
    if (!recipe) throw new Error('未找到这道菜谱')
    return recipe
  },
}
