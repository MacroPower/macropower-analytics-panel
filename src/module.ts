import { PanelPlugin, PanelOptionsEditorBuilder } from '@grafana/data';
import { AnalyticsPanel } from './AnalyticsPanel';
import defaults from './defaults.json';

interface AnalyticsOptions {
  server: string;
  dashboard: string;
  hidden: boolean;
  postStart: boolean;
  postKeepAlive: boolean;
  keepAliveInterval: number;
  postEnd: boolean;
  flatten: boolean;
}

export interface Options {
  analyticsOptions: AnalyticsOptions;
}

export const plugin = new PanelPlugin<Options>(AnalyticsPanel).setPanelOptions(
  (builder: PanelOptionsEditorBuilder<Options>) => {
    builder
      .addTextInput({
        path: 'analyticsOptions.server',
        name: 'Endpoint',
        defaultValue: defaults.endpoint,
        description: 'Location to send payload on panel load.',
      })
      .addTextInput({
        path: 'analyticsOptions.dashboard',
        name: 'Dashboard',
        defaultValue: defaults.dashboard,
        description: 'The name of the dashboard.',
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.hidden',
        name: 'Hide JSON',
        description: 'Hides the printed JSON object on the panel.',
        defaultValue: defaults.hidden,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postStart',
        name: 'Post Start',
        description: 'Sends a payload with {"type": "start"} when the dashboard is loaded.',
        defaultValue: defaults.postStart,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postKeepAlive',
        name: 'Post Keep-alive',
        description: 'Sends a payload with {"type": "keep-alive"} at regular intervals.',
        defaultValue: defaults.postKeepAlive,
      })
      .addNumberInput({
        path: 'analyticsOptions.keepAliveInterval',
        name: 'Keep-alive Interval',
        description: 'Frequency (in seconds) of keep-alive payloads.',
        defaultValue: defaults.keepAliveInterval,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postEnd',
        name: 'Post End',
        description: 'Sends a payload with {"type": "end"} when the dashboard is exited.',
        defaultValue: defaults.postEnd,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.flatten',
        name: 'Flatten',
        description: 'Flattens the payload JSON. Enable if you are using Telegraf.',
        defaultValue: defaults.flatten,
      });
  }
);
