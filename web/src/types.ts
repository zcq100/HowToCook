export interface Ingredient {
  id: string
  name: string
  kind: 'ingredient' | 'tool'
  amounts: string[]
  extra?: boolean
}

export interface Step {
  id: string
  index: number
  text: string
  notes: string[]
  uses: string[]
  times: string[]
  heat: string | null
}

export interface Recipe {
  id: string
  name: string
  category: string
  categoryName: string
  description: string
  difficulty: number
  calories: string | null
  images: string[]
  servingsNote: string
  ingredients: Ingredient[]
  steps: Step[]
  tips: string[]
}
