declare module "react-leaflet" {
  import type { ComponentType, ReactNode } from "react";
  import type {
    LatLngExpression,
    MapOptions,
    TileLayerOptions,
    CircleMarkerOptions,
  } from "leaflet";

  export interface MapContainerProps extends MapOptions {
    center?: LatLngExpression;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    scrollWheelZoom?: boolean;
    zoomControl?: boolean;
    className?: string;
    children?: ReactNode;
  }

  export interface TileLayerProps extends TileLayerOptions {
    url: string;
    attribution?: string;
  }

  export interface CircleMarkerProps extends CircleMarkerOptions {
    center: LatLngExpression;
    radius?: number;
    pathOptions?: import("leaflet").PathOptions;
    eventHandlers?: Record<string, (...args: unknown[]) => void>;
  }

  export const MapContainer: ComponentType<MapContainerProps>;
  export const TileLayer: ComponentType<TileLayerProps>;
  export const CircleMarker: ComponentType<CircleMarkerProps>;
  export function useMap(): import("leaflet").Map;
}
