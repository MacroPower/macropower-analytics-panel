export interface SimpleOptions {
  server: string;
  key: string;
  description: string;
  hidden: string;
}

export const defaults: SimpleOptions = {
  server: '',
  description: '',
  key: '',
  hidden: 'false',
};
