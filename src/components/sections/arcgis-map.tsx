'use client';

import { useEffect } from 'react';

// TypeScript declaration for the ArcGIS web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'arcgis-embedded-map': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'item-id'?:               string;
          'theme'?:                 string;
          'center'?:                string;
          'scale'?:                 string;
          'portal-url'?:            string;
          'bookmarks-enabled'?:     boolean | string;
          'heading-enabled'?:       boolean | string;
          'legend-enabled'?:        boolean | string;
          'information-enabled'?:   boolean | string;
          'basemap-gallery-enabled'?: boolean | string;
          'time-zone-label-enabled'?: boolean | string;
        },
        HTMLElement
      >;
    }
  }
}

export default function ArcGISMap() {
  useEffect(() => {
    if (document.querySelector('script[data-arcgis-embed]')) return;
    const script  = document.createElement('script');
    script.type   = 'module';
    script.src    = 'https://js.arcgis.com/5.0/embeddable-components/';
    script.setAttribute('data-arcgis-embed', '1');
    document.head.appendChild(script);
  }, []);

  return (
    <arcgis-embedded-map
      style={{ height: '600px', width: '100%', borderRadius: 2 }}
      item-id="a6217443465847d9b22c2b377dd7eaf3"
      theme="dark"
      center="74.82500578789441,12.895638511923332"
      scale="144447.638572"
      portal-url="https://www.arcgis.com"
      bookmarks-enabled=""
      heading-enabled=""
      legend-enabled=""
      information-enabled=""
      basemap-gallery-enabled=""
      time-zone-label-enabled=""
    />
  );
}
