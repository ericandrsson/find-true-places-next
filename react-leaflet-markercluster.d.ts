declare module 'react-leaflet-markercluster' {
  import { FC } from 'react';
  import L from 'leaflet';
  import 'leaflet.markercluster';

  interface MarkerClusterGroupProps extends L.MarkerClusterGroupOptions {
    children: React.ReactNode;
    chunkedLoading?: boolean;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    maxClusterRadius?: number;
    iconCreateFunction?: (cluster: L.MarkerCluster) => L.DivIcon;
  }

  const MarkerClusterGroup: FC<MarkerClusterGroupProps>;

  export default MarkerClusterGroup;
}