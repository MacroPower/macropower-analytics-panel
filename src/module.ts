import {
  // FieldConfigProperty,
  PanelPlugin,
  PanelOptionsEditorBuilder,
} from '@grafana/data';
import { AnalyticsPanel } from './AnalyticsPanel';
import { Options } from './types';
import { ENDPOINT_DEFAULT } from './constants';

const url = window.location.href;

export const plugin = new PanelPlugin<Options>(AnalyticsPanel).setPanelOptions(
  (builder: PanelOptionsEditorBuilder<Options>) => {
    builder
      .addTextInput({
        path: 'analyticsOptions.server',
        name: 'Endpoint',
        defaultValue: ENDPOINT_DEFAULT,
        description: 'Location to POST data on panel load.',
      })
      .addTextInput({
        path: 'analyticsOptions.key',
        name: 'Dashboard ID',
        defaultValue: url.replace(/^.+\/d\//g, '').replace(/\/.+$/g, ''),
        description: 'Unique value to identify the dashboard.',
      })
      .addTextInput({
        path: 'analyticsOptions.description',
        name: 'Dashboard Description',
        defaultValue: url.replace(/^.+\/d\/.+\//g, '').replace(/\?.+$/g, ''),
        description: 'Description of the dashboard.',
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.hidden',
        name: 'Hide JSON',
        description: 'Hides the printed JSON object on the panel.',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.noCors',
        name: 'No CORS',
        description: 'Sets request mode to no-cors.',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.postEnd',
        name: 'Post End',
        description: 'Sends a second request when the panel is unloaded. Disable if you are using Telegraf.',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'analyticsOptions.flatten',
        name: 'Flatten',
        description: 'Flattens the payload JSON. Enable if you are using Telegraf.',
        defaultValue: true,
      });
  }
);
