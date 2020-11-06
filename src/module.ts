import { PanelPlugin, PanelOptionsEditorBuilder } from '@grafana/data';
import { AnalyticsPanel } from './AnalyticsPanel';
import defaults from './defaults.json';

interface AnalyticsOptions {
  server: string;
  dashboard: string;
  showDetails: boolean;
  postStart: boolean;
  postHeartbeat: boolean;
  heartbeatInterval: number;
  heartbeatAlways: boolean;
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
        description: 'The endpoint to which to payloads will be sent.',
      })
      .addTextInput({
        path: 'analyticsOptions.dashboard',
        name: 'Dashboard',
        defaultValue: defaults.dashboard,
        description: `The name of the dashboard.
                      Use "$__dashboard" to reference the name of the current dashboard.`,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.showDetails',
        name: 'Show Details',
        description: `Shows the printed JSON object on the panel.
                      Displays any errors as full error with a retry button.
                      Enabling this option will not allow Grafana to count errors in meta-analytics.
                      Note that this option may require you to save the dashboard and reload the page to take effect.`,
        defaultValue: defaults.showDetails,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postStart',
        name: 'Post Start',
        description: 'Sends a payload with {"type": "start"} when the dashboard is loaded.',
        defaultValue: defaults.postStart,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postEnd',
        name: 'Post End',
        description: `Sends a payload with {"type": "end"} when the dashboard is exited.
                      Note that this payload will not be sent if the browser or tab is closed.`,
        defaultValue: defaults.postEnd,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postHeartbeat',
        name: 'Post Heartbeat',
        description: 'Sends a payload with {"type": "heartbeat"} at regular intervals.',
        defaultValue: defaults.postHeartbeat,
      })
      .addNumberInput({
        path: 'analyticsOptions.heartbeatInterval',
        name: 'Heartbeat Interval',
        description: 'Frequency (in seconds) of heartbeat payloads.',
        defaultValue: defaults.heartbeatInterval,
        showIf: (config: Options) => config.analyticsOptions.postHeartbeat,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.heartbeatAlways',
        name: 'Heartbeat Always',
        description: `Send heartbeat payloads even when the dashboard is not in focus.
                      This will continue messages when the dashboard is not visible or when another window has focus.
                      Leave this option disabled unless you know what you're doing.`,
        defaultValue: defaults.heartbeatAlways,
        showIf: (config: Options) => config.analyticsOptions.postHeartbeat,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.flatten',
        name: 'Flatten',
        description: `Flattens the payload JSON.
                      This may make ingestion easier if you use a simple HTTP listener like Telegraf.`,
        defaultValue: defaults.flatten,
      });
  }
);
