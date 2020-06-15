import { PanelProps } from '@grafana/data';

export interface Props extends PanelProps<Options> {}

export interface AnalyticsOptions {
  server: string;
  key: string;
  description: string;
  hidden: boolean;
  postEnd: boolean;
  noCors: boolean;
  flatten: boolean;
}

export interface Options {
  analyticsOptions: AnalyticsOptions;
}
