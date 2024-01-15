import { join } from 'path';
import Database, { Database as SQLiteDB } from 'better-sqlite3';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { BadRequestError } from '@map-colonies/error-types';
import { IConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { Grid } from '../layers/interfaces';

interface IMatrixValues {
  matrixWidth: number;
  matrixHeight: number;
}

@injectable()
export class SQLiteClient {
  public readonly packageName: string;
  private readonly fullPath: string;
  private readonly layerSourcesPath: string;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    packageName: string,
    originDirectory: string
  ) {
    this.layerSourcesPath = this.config.get<string>('layerSourceDir');
    this.packageName = packageName;
    this.fullPath = join(this.layerSourcesPath, originDirectory, this.packageName);
  }

  public getDB(fileMustExistFlag: boolean): SQLiteDB {
    try {
      return new Database(this.fullPath, { fileMustExist: fileMustExistFlag });
    } catch (err) {
      const message = `Can't open file ${this.fullPath} as SQLiteDB`;
      this.logger.error({
        msg: message,
        filePath: this.fullPath,
        err: err,
      });
      throw new BadRequestError(message);
    }
  }

  public getGpkgIndex(): boolean {
    let db: SQLiteDB | undefined = undefined;
    try {
      db = this.getDB(true);
      const tableName = this.getGpkgTableName(db);
      return this.getGpkgUniqueConstraintIndex(db, tableName) || this.getGpkgManualIndex(db, tableName);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const message = `Failed to validate GPKG index: ${(err as Error).message}`;
      this.logger.error({
        msg: message,
        err: err,
      });
      throw new Error(message);
    } finally {
      this.logger.debug({
        msg: `Closing connection to GPKG in path ${this.fullPath}`,
      });
      if (db !== undefined) {
        db.close();
      }
    }
  }

  public getGrid(): Grid | undefined {
    let db: SQLiteDB | undefined = undefined;
    try {
      db = this.getDB(true);
      // get the matrix_width and matrix_height
      const matrixQuery = 'SELECT MAX(matrix_width) as matrixWidth, MAX(matrix_height) as matrixHeight FROM gpkg_tile_matrix';
      const matrixValues = db.prepare(matrixQuery).get() as IMatrixValues;
      const result = Math.round(matrixValues.matrixWidth / matrixValues.matrixHeight);
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      if (result === 2) {
        return Grid.TWO_ON_ONE;
      } else if (result === 1) {
        return Grid.ONE_ON_ONE;
      }
    } catch (err) {
      const message = `Failed to get grid type: ${(err as Error).message}`;
      this.logger.error({
        msg: message,
        err: err,
      });
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(message);
    } finally {
      this.logger.debug({
        msg: `Closing connection to GPKG in path ${this.fullPath}`,
      });
      if (db !== undefined) {
        db.close();
      }
    }
  }

  public getGpkgTileWidthAndHeight(): { tileWidth: number; tileHeight: number } {
    let db: SQLiteDB | undefined = undefined;
    try {
      db = this.getDB(true);
      const sql = `SELECT tile_width,tile_height FROM "gpkg_tile_matrix" group by tile_width,tile_height;`;
      this.logger.debug({ msg: `Executing query ${sql} on DB ${this.fullPath}` });
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const tilesSizes = db.prepare(sql).all() as { tile_width: number; tile_height: number }[];
      if (tilesSizes.length !== 1) {
        const message = 'invalid gpkg, all tile_width and tile_height must be same pixel size';
        this.logger.error({
          tilesSizes: tilesSizes,
          msg: message,
        });
        throw new Error(message);
      }
      this.logger.debug({
        msg: `Extract tile sizes: ${tilesSizes[0].tile_width}, ${tilesSizes[0].tile_height}`,
      });
      return { tileWidth: tilesSizes[0].tile_width, tileHeight: tilesSizes[0].tile_height };
    } catch (err) {
      const message = `Failed to get tiles sizes type: ${(err as Error).message}`;
      this.logger.error({
        msg: message,
        err: err,
      });
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(message);
    } finally {
      this.logger.debug({
        msg: `Closing connection to GPKG in path ${this.fullPath}`,
      });
      if (db !== undefined) {
        db.close();
      }
    }
  }

  private getGpkgManualIndex(db: SQLiteDB, tableName: string): boolean {
    const sql = `SELECT count(*) as count
      FROM sqlite_master 
        WHERE type = 'index' AND tbl_name='${tableName}' AND sql LIKE '%zoom_level%'
         AND sql LIKE '%tile_column%'
          AND sql LIKE '%tile_row%';`;

    this.logger.debug({
      msg: `Executing query ${sql} on DB ${this.fullPath}`,
    });
    const indexCount = (db.prepare(sql).get() as { count: number }).count;
    return indexCount != 0;
  }

  private getGpkgUniqueConstraintIndex(db: SQLiteDB, tableName: string): boolean {
    let sql = `SELECT name FROM pragma_index_list('${tableName}') WHERE "unique" = 1 AND origin = 'u';`;
    this.logger.debug({
      msg: `Executing query ${sql} on DB ${this.fullPath}`,
    });
    const indexes = db.prepare(sql).all() as { name: string }[];
    for (const index of indexes) {
      sql = `SELECT name FROM pragma_index_info('${index.name}');`;
      this.logger.debug({
        msg: `Executing query ${sql} on DB ${this.fullPath}`,
      });
      const cols = (db.prepare(sql).all() as { name: string }[]).map((c) => c.name);
      if (cols.includes('tile_column') && cols.includes('tile_row') && cols.includes('zoom_level')) {
        return true;
      }
    }
    return false;
  }

  private getGpkgTableName(db: SQLiteDB): string {
    const sql = `SELECT table_name FROM "gpkg_contents";`;
    this.logger.debug({ msg: `Executing query ${sql} on DB ${this.fullPath}` });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const tableNames = db.prepare(sql).all() as { table_name: string }[];
    if (tableNames.length !== 1) {
      const message = 'invalid gpkg, should have single table name';
      this.logger.error({
        tableNames: tableNames,
        msg: message,
      });
      throw new Error(message);
    }
    this.logger.debug({
      msg: `Extract table name: ${tableNames[0].table_name}`,
    });
    return tableNames[0].table_name;
  }
}
