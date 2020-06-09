import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { AnalyticsOptions } from 'types';
import { contextSrv } from 'grafana/app/core/core';

interface Props extends PanelProps<AnalyticsOptions> {}

function getDate() {
  return Math.floor(new Date().getTime() / 1000);
}

export class AnalyticsPanel extends PureComponent<Props> {
  state = {
    host: window.location.href.replace(/^.+\/\//g, '').replace(/\/.+$/g, ''),
    update: '',
    user: contextSrv.user,
  };

  body = () => {
    return { ...this.props.options, ...this.state, ...{ time: getDate() } };
  };

  componentDidMount() {
    const { options } = this.props;

    fetch(options.server, {
      method: 'POST',
      body: JSON.stringify(this.body()),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(r => r.json())
      .then(r => this.setState({ update: r.location }));
  }

  componentWillUnmount() {
    const { options } = this.props;

    if (options.postEnd) {
      fetch(options.server + '/' + this.state.update, {
        method: 'POST',
        body: JSON.stringify(this.body()),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  render() {
    const { options, width, height } = this.props;

    return (
      !options.hidden && (
        <div
          style={{
            position: 'relative',
            width,
            height,
          }}
        >
          <pre>{JSON.stringify(this.body(), null, 1)}</pre>
        </div>
      )
    );
  }
}
