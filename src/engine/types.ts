export type ModuleId = 'conjugation' | 'cases' | 'vowelHarmony' | 'wordOrder' | 'numbers';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type ExerciseType = 'multipleChoice' | 'fillInBlank' | 'wordOrder' | 'classify';

export interface Exercise {
  id: string;
  module: ModuleId;
  type: ExerciseType;
  difficulty: Difficulty;
  prompt: string;
  /** For word order: scrambled tokens to reorder */
  words?: string[];
  options?: string[];
  correctAnswer: string;
  /** Pipe-joined or parallel to words order for wordOrder type */
  correctWords?: string[];
  explanation: string;
}
