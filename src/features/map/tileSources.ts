/** A Leaflet tile layer configuration. */
export interface TileSource {
  key: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  /** Whether marker coords need WGS-84 → GCJ-02 conversion (Chinese datum). */
  gcj02: boolean;
}

export const OSM: TileSource = {
  key: 'osm',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap',
  gcj02: false,
};

export const AMAP: TileSource = {
  key: 'china-amap',
  url: 'http://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
  attribution: '&copy; 高德地图',
  subdomains: ['1', '2', '3', '4'],
  gcj02: true,
};

export const TIANDITU: TileSource = {
  key: 'china-tianditu',
  url: 'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=7bd4dd0bc5f8b384925e97953f9325aa',
  attribution: '&copy; 国家地理信息公共服务平台',
  subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
  // Tianditu vec layer is published in GCJ-02.
  gcj02: true,
};

export type ChinaProvider = 'amap' | 'tianditu';

/** Selects the active tile source from the UI toggles. */
export function selectTileSource(isChina: boolean, provider: ChinaProvider): TileSource {
  if (!isChina) return OSM;
  return provider === 'amap' ? AMAP : TIANDITU;
}
