import React, { PureComponent } from 'react';
import { LegacyForms, Select, PanelOptionsGroup } from '@grafana/ui';
const { FormField } = LegacyForms;
import { PanelEditorProps } from '@grafana/data';
import { AnalyticsOptions } from './types';
import { SelectableValue } from '@grafana/data/types/select';

export class AnalyticsEditor extends PureComponent<PanelEditorProps<AnalyticsOptions>> {
  onServerChanged = ({ target }: any) => {
    this.props.onOptionsChange({ ...this.props.options, server: target.value });
  };

  onKeyChanged = ({ target }: any) => {
    this.props.onOptionsChange({ ...this.props.options, key: target.value });
  };

  onDescriptionChanged = ({ target }: any) => {
    this.props.onOptionsChange({ ...this.props.options, description: target.value });
  };

  onHiddenChanged = (item: SelectableValue<string>) => {
    const hide = item.value === 'True' ? true : false;
    this.props.onOptionsChange({ ...this.props.options, hidden: hide });
  };

  onPostEndChanged = (item: SelectableValue<string>) => {
    const post = item.value === 'True' ? true : false;
    this.props.onOptionsChange({ ...this.props.options, postEnd: post });
  };

  componentWillMount() {
    const { options } = this.props;
    const url = window.location.href;

    if (options.key === '') {
      options.key = url.replace(/^.+\/d\//g, '').replace(/\/.+$/g, '');
      this.props.onOptionsChange({ ...this.props.options });
    }

    if (options.description === '') {
      options.description = url.replace(/^.+\/d\/.+\//g, '').replace(/\?.+$/g, '');
      this.props.onOptionsChange({ ...this.props.options });
    }
  }

  hValue = (b: boolean): string => {
    return b ? 'True' : 'False';
  };

  render() {
    const { options } = this.props;

    return (
      <div className="section gf-form-group">
        <h5 className="section-heading">Server</h5>
        <FormField
          label="URL"
          labelWidth={10}
          inputWidth={40}
          type="text"
          onChange={this.onServerChanged}
          value={options.server || ''}
        />
        <br />
        <h5 className="section-heading">Settings</h5>
        <FormField
          label="Unique ID"
          labelWidth={10}
          inputWidth={20}
          type="text"
          onChange={this.onKeyChanged}
          value={options.key || ''}
        />
        <FormField
          label="Description"
          labelWidth={10}
          inputWidth={80}
          type="text"
          onChange={this.onDescriptionChanged}
          value={options.description || ''}
        />
        <br />
        <PanelOptionsGroup title="Post End">
          <Select
            value={{ value: this.hValue(options.postEnd), label: this.hValue(options.postEnd) }}
            onChange={this.onPostEndChanged}
            options={[
              { label: 'False', value: 'False' },
              { label: 'True', value: 'True' },
            ]}
          />
        </PanelOptionsGroup>
        <br />
        <PanelOptionsGroup title="Hidden">
          <Select
            value={{ value: this.hValue(options.hidden), label: this.hValue(options.hidden) }}
            onChange={this.onHiddenChanged}
            options={[
              { label: 'False', value: 'False' },
              { label: 'True', value: 'True' },
            ]}
          />
        </PanelOptionsGroup>
      </div>
    );
  }
}
