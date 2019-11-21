export interface SimpleOptions {
  server: string;
  key: string;
  description: string;
  hidden: boolean;
  postEnd: boolean;
}

export const defaults: SimpleOptions = {
  server: '',
  description: '',
  key: '',
  hidden: false,
  postEnd: true,
};
