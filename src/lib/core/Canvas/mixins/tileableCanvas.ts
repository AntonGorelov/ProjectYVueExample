import Point from '@/lib/core/utils/classes/Point';
import Tile from '@/lib/core/utils/classes/Tile';
import buildEvent from '@/lib/core/utils/buildEvent';

import Canvas from '..';

const _onMouseMoveHandler = Symbol('_onMouseMoveHandler');
const _onMouseOutHandler = Symbol('_onMouseOutHandler');

const CLASS_NAME = Symbol.for('TileableCanvas');

export const BACKGROUND_LAYER = '-1';
export const ZERO_LAYER = '0';
export const FOREGROUND_LAYER = '1';
export const SYSTEM_UI_LAYER = '2';

export type LAYER_INDEX = '-1' | '0' | '1' | '2';

interface ILayerCache {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  isDirty: boolean;
}

const createCache = () => {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    isDirty: true,
  };
};

const LAYER_INDEXES = [BACKGROUND_LAYER, ZERO_LAYER, FOREGROUND_LAYER, SYSTEM_UI_LAYER];

const TileableCanvasMixin = (BaseClass = Canvas) => {
  if (!(BaseClass === Canvas || Canvas.isPrototypeOf(BaseClass))) {
    throw new Error('BaseClass isn\'t prototype of Canvas!');
  }

  class TileableCanvas extends BaseClass {
    private _tiles: Map<string, Tile> = null;
    private _hoverTile: Tile = null;
    protected _tileSize = {
      x: 16,
      y: 16,
    };

    private _visibleLayersChanged: boolean = false;
    private _visibleLayers: LAYER_INDEX[] = [BACKGROUND_LAYER, ZERO_LAYER, FOREGROUND_LAYER, SYSTEM_UI_LAYER];

    _layers: Hash<Map<string, Tile>> = {
      [BACKGROUND_LAYER]: new Map<string, Tile>(),
      [ZERO_LAYER]: new Map<string, Tile>(),
      [FOREGROUND_LAYER]: new Map<string, Tile>(),
      [SYSTEM_UI_LAYER]: new Map<string, Tile>(),
    };

    _layersCache: Hash<ILayerCache> = {
      [BACKGROUND_LAYER]: createCache(),
      [ZERO_LAYER]: createCache(),
      [FOREGROUND_LAYER]: createCache(),
      [SYSTEM_UI_LAYER]: createCache(),
    };

    _columnsNumber = 0;
    _rowsNumber = 0;

    public get sizeInTiles() {
      return {
        x: this._columnsNumber,
        y: this._rowsNumber,
      };
    }

    // current
    get tiles() { return this._tiles; }
    set tiles(tiles) { throw new Error('It\'s property read only!'); }

    [_onMouseMoveHandler](event: MouseEvent) {
      this._hoverTilePlace(...this._transformEventCoordsToGridCoords(event.offsetX, event.offsetY));
      this._renderInNextFrame();
    }

    [_onMouseOutHandler](event: MouseEvent) {
      this._hoverTilePlace(-1, -1);
      this._renderInNextFrame();
    }

    _getTile(x: number, y: number, z: LAYER_INDEX = ZERO_LAYER) {
      const layer = this._layers[z];
      return layer.get(`${y}|${x}`);
    }

    _updateTileByCoord(x: number, y: number, z: LAYER_INDEX = ZERO_LAYER, tile: Tile) {
      const layer = this._layers[z];
      // @TODO Optimization
      this._layersCache[z].isDirty = true;

      if (tile != null) {
        if (layer.get(`${y}|${x}`) === tile) return;
        layer.set(`${y}|${x}`, tile);
      } else {
        if (!layer.has(`${y}|${x}`)) return;
        layer.delete(`${y}|${x}`);
      }
    }

    _hoverTilePlace(x: number, y: number) {
      for (const [place, tile] of this._layers[SYSTEM_UI_LAYER].entries()) {
        if (tile != null) {
          const [_y, _x] = Point.fromString(place).toArray();
          if (Point.isEqual(x, y, _x, _y)) return;

          this._updateTileByCoord(_x, _y, SYSTEM_UI_LAYER, null);
        }
      }
      this._updateTileByCoord(x, y, SYSTEM_UI_LAYER, this._hoverTile);
    }

    invalidateCache(level: LAYER_INDEX | 'ALL') {
      if (level === 'ALL') {
        for (const layerIndex of LAYER_INDEXES) {
          this._layersCache[layerIndex].isDirty = true;
        }
      } else this._layersCache[level].isDirty = true;
    }

    updateVisibleLayers(levels: LAYER_INDEX[]) {
      this._visibleLayers = <LAYER_INDEX[]>[...levels, SYSTEM_UI_LAYER].sort();
      this._visibleLayersChanged = true;
      this._renderInNextFrame();
    }

    _clearLayer(level: LAYER_INDEX | 'ALL') {
      if (level === 'ALL') {
        for (const layerIndex of LAYER_INDEXES) {
          this._layers[layerIndex].clear();
        }
      } else this._layers[level].clear();
      this.invalidateCache(level);
    }

    clearLayer(level: LAYER_INDEX | 'ALL') {
      this._clearLayer(level);
      this._renderInNextFrame();
    }

    _drawTiles() {
      for (const layerIndex of this._visibleLayers) {
        this._drawLayer(this._layers[layerIndex], this._layersCache[layerIndex]);
      }
    }

    _drawLayer(layer: Map<string, Tile>, cache: ILayerCache) {
      // @TODO Optimization
      if (cache.isDirty) {
        // eslint-disable-next-line no-param-reassign
        cache.isDirty = false;
        cache.ctx.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
        for (const [place, tile] of layer.entries()) {
          // eslint-disable-next-line no-param-reassign
          cache.ctx.imageSmoothingEnabled = this._imageSmoothingEnabled;
          const [y, x] = Point.fromString(place).toArray();
          cache.ctx.drawImage(
            tile.source.data,
            tile.sourceRegion.x * tile.source.tileSize.x,
            tile.sourceRegion.y * tile.source.tileSize.y,
            tile.source.tileSize.x,
            tile.source.tileSize.y,
            x * this._tileSize.x,
            y * this._tileSize.y,
            this._tileSize.x,
            this._tileSize.y,
          );
        }
      }

      // Render layer cache
      this._ctx.drawImage(cache.canvas, 0, 0, this._el.width, this._el.height);
    }

    private _drawGrid() {
      this._ctx.save();
      this._ctx.strokeStyle = 'hsla(0, 100%, 0%, 60%)';
      this._ctx.beginPath();
      this._ctx.setLineDash([4, 2]);
      this._ctx.lineWidth = 0.4;
      for (let i = 0; i <= this._columnsNumber; i += 1) {
        const lineX = i * this._tileSize.x;
        this._ctx.moveTo(lineX, 0);
        this._ctx.lineTo(lineX, this.height);
      }
      for (let i = 0; i <= this._rowsNumber; i += 1) {
        const lineY = i * this._tileSize.y;
        this._ctx.moveTo(0, lineY);
        this._ctx.lineTo(this.width, lineY);
      }
      this._ctx.stroke();
      this._ctx.restore();
    }

    protected _render(time: number, clearRender = false) {
      this._ctx.imageSmoothingEnabled = this._imageSmoothingEnabled;
      if (!this._visibleLayersChanged) {
        let reallyNeedRender = false;
        for (const layerIndex of this._visibleLayers) {
          if (this._layersCache[layerIndex].isDirty) {
            reallyNeedRender = true;
            break;
          }
        }
        if (!reallyNeedRender) return;
      }
      // @TODO That time might be used for checking time between renders
      this.clear();
      this._drawTiles();
      this.dispatchEvent(buildEvent(':render', null, { ctx: this._ctx }));
      if (!clearRender) this._drawGrid();
    }

    private _calcGrid() {
      this._columnsNumber = Math.trunc(this.width / this._tileSize.x);
      this._rowsNumber = Math.trunc(this.height / this._tileSize.y);
    }

    protected _transformEventCoordsToGridCoords(eventX: number, eventY: number): [number, number] {
      return [Math.trunc(eventX / this._tileSize.x), Math.trunc(eventY / this._tileSize.y)];
    }

    protected async _initListeners() {
      await super._initListeners();

      this._el.addEventListener('mousemove', this[_onMouseMoveHandler], { passive: true });
      this._el.addEventListener('mouseout', this[_onMouseOutHandler], { passive: true });
    }

    private async _prepareHoverTileMask() {
      const canvas = document.createElement('canvas');
      Reflect.set(this._el.style, 'image-rendering', 'pixelated');
      canvas.width = this._tileSize.x;
      canvas.height = this._tileSize.y;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'hsla(0, 0%, 0%, .1)';
      ctx.fillRect(0, 0, this._tileSize.x, this._tileSize.y);

      const source: ISource = {
        data: canvas,
        tileSize: {
          x: this._tileSize.x,
          y: this._tileSize.y,
        },
      };

      this._hoverTile = Tile.fromTileMeta({ source, sourceRegion: { x: 0, y: 0 } }, this._tileSize);
    }

    protected _resize(multiplier: number) {
      this._tileSize.x *= multiplier;
      this._tileSize.y *= multiplier;
      // @ts-ignore
      if (super._resize != null) super._resize(multiplier);
      this._renderInNextFrame();
    }

    constructor(options: any = {}) {
      super(options);

      this[_onMouseMoveHandler] = this[_onMouseMoveHandler].bind(this);
      this[_onMouseOutHandler] = this[_onMouseOutHandler].bind(this);

      if (options.tileSize != null && options.tileSize.x != null) this._tileSize.x = options.tileSize.x;
      if (options.tileSize != null && options.tileSize.y != null) this._tileSize.y = options.tileSize.y;
    }

    async init() {
      this._calcGrid();

      await this._prepareHoverTileMask();

      await super.init();
    }

    public async updateCurrentTiles(tiles: Map<string, Tile>) {
      this._tiles = tiles;
      this._renderInNextFrame();
    }

    updateSize(width: number, height: number) {
      super.updateSize(width, height);
      for (const layerIndex of LAYER_INDEXES) {
        this._layersCache[layerIndex].canvas.width = this._el.width;
        this._layersCache[layerIndex].canvas.height = this._el.height;
      }
      this._calcGrid();
      this.invalidateCache('ALL');
      this._renderInNextFrame();
    }

    updateTilesCount(width: number, height: number) {
      this.updateSize(width * this._tileSize.x, height * this._tileSize.y);
    }
  }

  TileableCanvas._metaClassNames = [...(BaseClass._metaClassNames || []), CLASS_NAME];

  return TileableCanvas;
};

export default TileableCanvasMixin;

export const TileableCanvas = TileableCanvasMixin();
