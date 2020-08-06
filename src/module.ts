import {
  // FieldConfigProperty,
  PanelPlugin,
  PanelOptionsEditorBuilder,
} from '@grafana/data';
import { AnalyticsPanel } from './AnalyticsPanel';
import { Options } from './types';
import { getDashboard } from 'utils';
import defaults from './defaults.json';

// set dynamic defaults
const url = window.location.href;
const dashboard = getDashboard(url);

export const plugin = new PanelPlugin<Options>(AnalyticsPanel).setPanelOptions(
  (builder: PanelOptionsEditorBuilder<Options>) => {
    builder
      .addTextInput({
        path: 'analyticsOptions.server',
        name: 'Endpoint',
        defaultValue: defaults.endpoint,
        description: 'Location to POST data on panel load.',
      })
      .addTextInput({
        path: 'analyticsOptions.key',
        name: 'Dashboard ID',
        defaultValue: dashboard.uid,
        description: 'Unique value to identify the dashboard.',
      })
      .addTextInput({
        path: 'analyticsOptions.description',
        name: 'Dashboard Description',
        defaultValue: dashboard.name,
        description: 'Description of the dashboard.',
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.hidden',
        name: 'Hide JSON',
        description: 'Hides the printed JSON object on the panel.',
        defaultValue: defaults.hidden,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.noCors',
        name: 'No CORS',
        description: 'Sets request mode to no-cors.',
        defaultValue: defaults.noCors,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postEnd',
        name: 'Post End',
        description: 'Sends a second request when the panel is unloaded. Disable if you are using Telegraf.',
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
