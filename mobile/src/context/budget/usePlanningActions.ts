import type { Budget, Goal } from '../../types';

interface UsePlanningActionsParams {
  budgets: Budget[];
  goals: Goal[];
  persistBudgets: (next: Budget[]) => void;
  persistGoals: (next: Goal[]) => void;
}

export function usePlanningActions({
  budgets,
  goals,
  persistBudgets,
  persistGoals,
}: UsePlanningActionsParams) {
  const addBudget = (b: Omit<Budget, 'id' | 'createdAt'>) => {
    const next: Budget = {
      ...b,
      id: `${Date.now()}-${b.category.toLowerCase().replace(/\s+/g, '-')}`,
      createdAt: new Date().toISOString(),
    };
    persistBudgets([next, ...budgets]);
  };

  const updateBudget = (updated: Budget) => {
    persistBudgets(budgets.map((b) => (b.id === updated.id ? updated : b)));
  };

  const removeBudget = (id: string) => {
    persistBudgets(budgets.filter((b) => b.id !== id));
  };

  const addGoal = (g: Omit<Goal, 'id' | 'createdAt' | 'status' | 'completedAt'>) => {
    const next: Goal = {
      ...g,
      id: `${Date.now()}-${g.name.toLowerCase().replace(/\s+/g, '-')}`,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    persistGoals([next, ...goals]);
  };

  const updateGoal = (updated: Goal) => {
    persistGoals(goals.map((goal) => (goal.id === updated.id ? updated : goal)));
  };

  const removeGoal = (id: string) => {
    persistGoals(goals.filter((goal) => goal.id !== id));
  };

  const pauseGoal = (id: string) => {
    persistGoals(
      goals.map((goal) =>
        goal.id === id && goal.status === 'active'
          ? { ...goal, status: 'paused', completedAt: undefined }
          : goal,
      ),
    );
  };

  const resumeGoal = (id: string) => {
    persistGoals(
      goals.map((goal) =>
        goal.id === id && goal.status === 'paused'
          ? { ...goal, status: 'active', completedAt: undefined }
          : goal,
      ),
    );
  };

  const markGoalComplete = (id: string) => {
    persistGoals(
      goals.map((goal) =>
        goal.id === id
          ? { ...goal, status: 'completed', completedAt: new Date().toISOString() }
          : goal,
      ),
    );
  };

  return {
    addBudget,
    updateBudget,
    removeBudget,
    addGoal,
    updateGoal,
    removeGoal,
    pauseGoal,
    resumeGoal,
    markGoalComplete,
  };
}
