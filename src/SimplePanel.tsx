import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/ui';
import { SimpleOptions } from 'types';
import { contextSrv } from 'grafana/app/core/core';

interface Props extends PanelProps<SimpleOptions> {}

function getDate() {
  return Math.floor(new Date().getTime() / 1000);
}

export class SimplePanel extends PureComponent<Props> {
  state = {
    host: window.location.href.replace(/^.+\/\//g, '').replace(/\/.+$/g, ''),
    time: undefined,
    mode: undefined,
    user: contextSrv.user,
  };

  componentDidMount() {
    this.setState({ time: getDate(), mode: 0 });

    fetch(this.props.options.server, {
      method: 'POST',
      body: JSON.stringify({ ...this.props.options, ...this.state }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  componentWillUnmount() {
    this.setState({ time: getDate(), mode: 1 });

    fetch(this.props.options.server, {
      method: 'POST',
      body: JSON.stringify(this.state),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  render() {
    const { options, width, height } = this.props;

    let display = true;
    if (options.hidden === 'true') {
      display = false;
    }

    return (
      display && (
        <div
          style={{
            position: 'relative',
            width,
            height,
          }}
        >
          <pre>{JSON.stringify({ ...options, ...this.state }, null, 1)}</pre>
        </div>
      )
    );
  }
}
