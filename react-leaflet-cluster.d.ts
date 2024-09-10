declare module 'react-leaflet-markercluster' {
  import { FC } from 'react';
  import L from 'leaflet';
  import 'leaflet.markercluster';

  interface MarkerClusterGroupProps extends L.MarkerClusterGroupOptions {
    children: React.ReactNode;
    chunkedLoading?: boolean;
  }

  const MarkerClusterGroup: FC<MarkerClusterGroupProps>;

  export default MarkerClusterGroup;
}

declare module 'leaflet' {
  export interface MarkerClusterGroup extends L.FeatureGroup {
    getChildCount(): number;
  }
}