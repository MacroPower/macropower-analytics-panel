import React, { PureComponent } from 'react';
import { FormField } from '@grafana/ui';
import { PanelEditorProps } from '@grafana/ui';

import { SimpleOptions } from './types';

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

  onHiddenChanged = ({ target }: any) => {
    this.props.onOptionsChange({ ...this.props.options, hidden: target.value });
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

    if (options.hidden === '') {
      options.hidden = 'false';
      this.props.onOptionsChange({ ...this.props.options });
    }
  }

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
        <FormField label="Hidden" labelWidth={10} inputWidth={40} type="text" onChange={this.onHiddenChanged} value={options.hidden || ''} />
      </div>
    );
  }
}
