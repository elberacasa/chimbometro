/** Wire types for TypeSafe's System One HTTP API (https://docs.typesafe.ai/api). */

type Text = string | string[] | Record<string, unknown>;

export type NoulQuestion = { type: "noul"; instructions: Text };
export type ChoiceQuestion = {
  type: "choice";
  instructions: Text;
  criteria: Record<string, string | null>;
};
export type ScoreQuestion = { type: "score"; instructions: Text; criteria: string[] };
export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

/** Maps each question to the answer type it produces. */
export type AnswerFor<Q extends Question> = Q extends NoulQuestion
  ? NoulAnswer
  : Q extends ChoiceQuestion
    ? ChoiceAnswer
    : ScoreAnswer;

export type Usage = { input_tokens: number; output_tokens: number };

export type SystemOneRequest<Qs extends Record<string, Question>> = {
  model: string;
  state: unknown;
  questions: Qs;
};

export type SystemOneResponse<Qs extends Record<string, Question>> = {
  model: string;
  answers: { [K in keyof Qs]: AnswerFor<Qs[K]> };
  usage: Usage;
};
