import { useCallback } from 'react';
import { getApi } from '../../api/restApi';
import type { DatabaseType } from '../../enums/databaseType';
import { DBInitType } from '../../enums/dbInitType';
import type { PostgresConfig } from '../../types/postgresConfig';
import type { MySqlConfig } from '../../types/mysqlConfig';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../ayncAction/useAsyncAction';

interface UseInitDBParams extends RequestHook<Response<unknown>> {
  fullPath?: string;
  mode?: DBInitType;
  dbType: DatabaseType;
  postgresConfig?: PostgresConfig;
  mysqlConfig?: MySqlConfig;
}

export const useDBInit = ({
  fullPath,
  mode = DBInitType.create,
  dbType,
  postgresConfig,
  mysqlConfig,
  immediate = true,
  showLoader = true,
  onDone
}: UseInitDBParams) => {
  const asyncFn = useCallback(
    () => getApi().initializeDatabase({ postgresConfig, mysqlConfig, fullPath, mode, dbType }),
    [fullPath, mode, postgresConfig, mysqlConfig, dbType]
  );
  const { data, execute } = useAsyncAction<Response<unknown>>(asyncFn, { showLoader, immediate, onDone });

  return { data, execute };
};
