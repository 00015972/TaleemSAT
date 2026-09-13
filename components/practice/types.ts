import type { Difficulty } from '@/lib/practice/overview';

export type PracticeOption = {
  id: string;
  text: string;
};

export type PracticeQuestion = {
  id: string;
  passage: string | null;
  question_text: string;
  question_image_url: string | null;
  chart_svg: string | null;
  tables: string[] | null;
  question_type: 'mcq' | 'grid_in';
  options: PracticeOption[];
  difficulty: Difficulty;
  tags: string[];
};

export type PracticeManifestEntry = {
  id: string;
  submissionId: string;
  difficulty: Difficulty;
};

export type PracticeBootstrap = {
  sessionId: string;
  ids: PracticeManifestEntry[];
  question: PracticeQuestion;
};
