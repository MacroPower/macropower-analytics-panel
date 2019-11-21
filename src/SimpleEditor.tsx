import React, { PureComponent } from 'react';
import { FormField, Select, PanelOptionsGroup, PanelEditorProps } from '@grafana/ui';
import { SimpleOptions } from './types';
import { SelectableValue } from '@grafana/data/types/select';

export class SimpleEditor extends PureComponent<PanelEditorProps<SimpleOptions>> {
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

  hValue = (): string => {
    return this.props.options.hidden ? 'True' : 'False';
  };

  render() {
    const { options } = this.props;

    return (
      <div className="section gf-form-group">
        <h5 className="section-heading">Server</h5>
        <FormField label="URL" labelWidth={10} inputWidth={40} type="text" onChange={this.onServerChanged} value={options.server || ''} />
        <br />
        <h5 className="section-heading">Settings</h5>
        <FormField label="Unique ID" labelWidth={10} inputWidth={20} type="text" onChange={this.onKeyChanged} value={options.key || ''} />
        <FormField
          label="Description"
          labelWidth={10}
          inputWidth={80}
          type="text"
          onChange={this.onDescriptionChanged}
          value={options.description || ''}
        />
        <br />
        <h5 className="section-heading">Display</h5>
        <PanelOptionsGroup title="Hidden">
          <Select
            value={{ value: this.hValue(), label: this.hValue() }}
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
