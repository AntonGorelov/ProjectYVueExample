import PureCanvas from '@/lib/core/utils/classes/PureCanvas';
import Point from '@/lib/core/utils/classes/Point';

export type LAYER_INDEX = '-1' | '0' | '1' | '2';

export const BACKGROUND_LAYER = '-1';
export const ZERO_LAYER = '0';
export const FOREGROUND_LAYER = '1';
export const SYSTEM_UI_LAYER = '2';

export class LayerCache extends PureCanvas {
  private _isDirty: boolean = true;

  public get isDirty() { return this._isDirty; }

  public invalidate() { this._isDirty = true; }
  public validate() { this._isDirty = false; }
}

export class Layer extends Map<string, IRenderedObject> {
  private _cache: LayerCache = new LayerCache({});

  public get isDirty() { return this._cache.isDirty; }

  private _render() {
    this._cache.clear();
    for (const [key, renderedObject] of this.entries()) {
      const [x, y] = this.parseKey(key);
      const tileBoundingRect = renderedObject.sourceBoundingRect;
      this._cache.drawImage(
        renderedObject.source,
        tileBoundingRect.x,
        tileBoundingRect.y,
        tileBoundingRect.width,
        tileBoundingRect.height,
        x * tileBoundingRect.x,
        y * tileBoundingRect.y,
        tileBoundingRect.width,
        tileBoundingRect.height,
      );
    }
  }

  public set(key: string, data: IRenderedObject): this {
    super.set(key, data);
    this.invalidateCache();
    return this;
  }

  public delete(key: string): boolean {
    const res = super.delete(key);
    if (res) this.invalidateCache();
    return res;
  }

  public clear(): void {
    super.clear();
    this.invalidateCache();
  }

  public buildKey(x: number, y: number): string {
    return new Point(x, y).toReverseString();
  }

  public parseKey(key: string): [number, number] {
    return Point.fromReverseString(key).toArray();
  }

  public invalidateCache() { this._cache.invalidate(); }
  public validateCache() { this._cache.validate(); }

  public resize(width: number, height: number) {
    this._cache.resize(width, height);
    this.invalidateCache();
  }

  public exist(x: number, y: number): boolean {
    return this.has(this.buildKey(x, y));
  }

  public take(x: number, y: number): IRenderedObject {
    return this.get(this.buildKey(x, y));
  }

  public add(x: number, y: number, data: IRenderedObject): this {
    return this.set(this.buildKey(x, y), data);
  }

  public remove(x: number, y: number): boolean {
    return this.delete(this.buildKey(x, y));
  }

  public getRenderedObject(): IRenderedObject {
    if (this.isDirty) {
      this._render();
      this.validateCache();
    }

    return {
      id: 'LAYER_CACHE_ID',
      source: this._cache.canvas,
      sourceBoundingRect: {
        x: 0,
        y: 0,
        width: this._cache.width,
        height: this._cache.height,
      },
    };
  }
}

export class GridLayer {
  private _cache: LayerCache = new LayerCache({});
  private _columnCount: number = 0;
  private _rowCount: number = 0;

  public get isDirty() { return this._cache.isDirty; }

  private _render() {
    const { ctx, width, height } = this._cache;
    const cellWidth = width / this._columnCount;
    const cellHeight = width / this._rowCount;

    this._cache.clear();
    ctx.save();
    ctx.strokeStyle = 'hsla(0, 100%, 0%, 60%)';
    ctx.beginPath();
    ctx.setLineDash([4, 2]);
    ctx.lineWidth = 0.4;
    for (let i = 0; i <= this._columnCount; i += 1) {
      const lineX = i * cellWidth;
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX, height);
    }
    for (let i = 0; i <= this._rowCount; i += 1) {
      const lineY = i * cellHeight;
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
    }
    ctx.stroke();
    ctx.restore();
  }

  public invalidateCache() { this._cache.invalidate(); }
  public validateCache() { this._cache.validate(); }

  public resize(width: number, height: number, columns: number, rows: number) {
    this._cache.resize(width, height);
    this._columnCount = columns;
    this._rowCount = rows;
    this.invalidateCache();
  }

  public getRenderedObject(): IRenderedObject {
    if (this.isDirty) {
      this._render();
      this.validateCache();
    }

    return {
      id: 'LAYER_CACHE_ID',
      source: this._cache.canvas,
      sourceBoundingRect: {
        x: 0,
        y: 0,
        width: this._cache.width,
        height: this._cache.height,
      },
    };
  }
}

export const buildLayers = (layersIndeces: LAYER_INDEX[]): Hash<Layer> => {
  const layers: Hash<Layer> = {};
  for (const layerIndex of layersIndeces) layers[layerIndex] = new Layer();
  return layers;
};

export default buildLayers;
