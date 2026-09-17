import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  IconButton,
  ListItemButton,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { isWebMode } from '../../shared/api/restApi';
import { DatabaseType } from '../../shared/enums/databaseType';
import { DBInitType } from '../../shared/enums/dbInitType';
import { useDBInit } from '../../shared/hooks/dbSelector/useDBInit';
import { useDBListSelector } from '../../shared/hooks/dbSelector/useDBListSelector';
import { useDBOpener } from '../../shared/hooks/dbSelector/useDBOpener';
import { useDBSelector } from '../../shared/hooks/dbSelector/useDBSelector';
import type { DBSelector } from '../../shared/types/dbSelector';
import type { Response } from '../../shared/types/response';
import { useAppDispatch } from '../../state/configureStore';
import { addToast } from '../../state/pageSlice';
import { NameSetter } from './modals/NameSetter';

interface Props {
  onDatabaseRead?: () => void;
}
export const LocalDatabase: FC<Props> = ({ onDatabaseRead }) => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const { t } = useTranslation();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [savedDbs, setSavedDbs] = useState<any[]>([]);
  const [selectionMode, setSelectionMode] = useState<DBInitType | undefined>(undefined);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDBSetterModalOpen, setIsDBSetterModalOpen] = useState(false);

  const { execute: getDBList } = useDBListSelector({
    immediate: false,
    onDone: (results: Response<any[]>) => {
      if (results.data) {
        setSavedDbs(results.data);
      }
    }
  });

  const { execute: selectDB } = useDBSelector({
    immediate: false,
    onDone: (results: Response<DBSelector>) => {
      if (results.data && !results.data.canceled && results.data.filePath) {
        setSelectionMode(DBInitType.create);
        setSelectedPath(results.data.filePath);
      }
    }
  });

  const { execute: openDB } = useDBOpener({
    immediate: false,
    onDone: (results: Response<DBSelector>) => {
      if (results.data && !results.data.canceled && results.data.filePath) {
        setSelectionMode(DBInitType.open);
        setSelectedPath(results.data.filePath);
      }
    }
  });

  const { execute: initDB } = useDBInit({
    fullPath: selectedPath ?? '',
    mode: selectionMode,
    dbType: DatabaseType.sqlite,
    immediate: false,
    onDone: (data: Response<unknown>) => {
      if (!data.success) {
        setSelectedPath(null);
        if (data.message) {
          const message = i18n.exists(data.message) ? t(data.message) : data.message;
          dispatch(addToast({ message: message, severity: 'error' }));
        } else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      } else {
        if (onDatabaseRead) onDatabaseRead();
      }
      setIsInitializing(false);
    }
  });

  const saveDbList = useCallback(
    (list: any[]) => {
      const sortedList = [...list].sort((a, b) => {
        const aName = typeof a === 'string' ? a : (a.name || '');
        const bName = typeof b === 'string' ? b : (b.name || '');
        return aName.localeCompare(bName);
      });
      setSavedDbs(sortedList);
      try {
        if (!isWebMode()) {
          localStorage.setItem('databases', JSON.stringify(sortedList));
        }
      } catch {
        dispatch(addToast({ message: t('error.failedToSave'), severity: 'error' }));
      }
    },
    [t, dispatch]
  );

  const handleOpenSaved = useCallback(
    async (fullPath: string) => {
      const newList = Array.from(new Set([fullPath, ...savedDbs]));
      saveDbList(newList);
      setIsInitializing(true);
      initDB();
    },
    [savedDbs, initDB, saveDbList]
  );

  const handleSelectPath = async () => {
    if (isWebMode()) {
      setIsDBSetterModalOpen(true);
    } else {
      selectDB();
    }
  };

  const handleOpenPath = () => {
    openDB();
  };

  const handleForget = (fullPath: string) => {
    const updated = savedDbs.filter(p => p !== fullPath);
    saveDbList(updated);
  };

  const getFileName = (fullPath: any) => {
    if (typeof fullPath === 'string') return fullPath.split(/[/\\]/).pop() ?? fullPath;
    return fullPath?.name || 'Unknown';
  };

  useEffect(() => {
    if (selectedPath && selectionMode) handleOpenSaved(selectedPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, selectionMode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('databases');
      if (raw && !isWebMode()) {
        setSavedDbs(JSON.parse(raw) as any[]);
      }

      const lastUsedLanguage = localStorage.getItem('lastUsedLanguage');
      if (lastUsedLanguage) i18n.changeLanguage(lastUsedLanguage);
    } catch {
      dispatch(addToast({ message: t('error.failedToLoad'), severity: 'error' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const [legacyDbs, setLegacyDbs] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (isWebMode()) {
      getDBList();
      fetch('/api/databases/legacy', { headers: { 'Accept': 'application/json' } })
        .then(res => res.json())
        .then(data => {
           if (data.success && data.data) {
              setLegacyDbs(data.data);
           }
        })
        .catch(console.error);
    }
  }, [getDBList]);

  const handleImportLegacy = async (filename: string) => {
    setIsImporting(true);
    try {
       const res = await fetch('/api/databases/import-legacy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
       });
       const data = await res.json();
       if (data.success) {
          dispatch(addToast({ message: 'Database imported successfully', severity: 'success' }));
          setLegacyDbs(prev => prev.filter(f => f !== filename));
          getDBList(); // Refresh saved dbs
       } else {
          dispatch(addToast({ message: data.message || 'Failed to import', severity: 'error' }));
       }
    } catch (e) {
       dispatch(addToast({ message: 'Error importing database', severity: 'error' }));
    } finally {
       setIsImporting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'start',
        gap: 3
      }}
    >
      {isWebMode() && isDBSetterModalOpen && (
        <>
          <NameSetter
            isOpen={isDBSetterModalOpen}
            onCancel={() => setIsDBSetterModalOpen(false)}
            onSave={name => {
              setSelectionMode(DBInitType.create);
              setSelectedPath(`${name}.db`);
              setIsDBSetterModalOpen(false);
            }}
          />
        </>
      )}

      <Typography variant="h5" noWrap component="div" sx={{ color: theme.palette.secondary.main }}>
        {!isWebMode() && <>{t('databaseChooser.title')}</>}
        {isWebMode() && <>{t('databaseChooser.titleWeb')}</>}
      </Typography>
      <Typography variant="body1" noWrap component="div" sx={{ whiteSpace: 'pre-wrap' }}>
        {!isWebMode() && <>{t('databaseChooser.description')}</>}
        {isWebMode() && <>{t('databaseChooser.descriptionWeb')}</>}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3
        }}
      >
        <Button variant="contained" onClick={handleSelectPath} disabled={isInitializing}>
          {t('databaseChooser.createNew')}
        </Button>
        {!isWebMode() && (
          <Button variant="contained" onClick={handleOpenPath} disabled={isInitializing}>
            {t('databaseChooser.openExisting')}
          </Button>
        )}
      </Box>

      {savedDbs.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fit, 300px)',
            justifyContent: 'center',
            justifyItems: 'center',
            alignItems: 'center',
            width: '100%'
          }}
        >
          {savedDbs.map(item => {
            const itemKey = typeof item === 'string' ? item : (item.id || item.name);
            const itemName = typeof item === 'string' ? item : item.name;
            return (
            <Paper
              key={itemKey}
              elevation={2}
              sx={{
                borderRadius: 1,
                bgcolor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                transition: 'all 0.2s ease-in-out',
                width: '300px',
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ListItemButton
                onClick={() => {
                  setSelectionMode(DBInitType.open);
                  setSelectedPath(itemName);
                }}
                sx={{
                  pt: 2,
                  pb: 2,
                  pl: 2,
                  pr: 2,
                  width: '100%',
                  borderRadius: 1,
                  display: 'flex',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'start',
                  flexDirection: 'column'
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'start',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%'
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography
                        component="div"
                        variant="body1"
                        sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {getFileName(item)}
                      </Typography>
                    }
                    disableTypography
                    slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                    secondary={
                      <Typography
                        component="div"
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: 'small',
                          fontWeight: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}
                      >
                        {itemName}
                      </Typography>
                    }
                  />
                </Box>

                {isWebMode() && (
                  <Tooltip title={t('common.delete')}>
                    <IconButton
                      onClick={e => {
                        e.stopPropagation();
                        handleForget(itemName);
                      }}
                      sx={{
                        color: theme.palette.error.main,
                        '&:hover': {
                          backgroundColor: theme.palette.error.light,
                          color: theme.palette.error.contrastText
                        }
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {!isWebMode() && (
                  <Tooltip title={t('common.forget')}>
                    <IconButton
                      onClick={e => {
                        e.stopPropagation();
                        handleForget(itemName);
                      }}
                      sx={{
                        color: theme.palette.error.main,
                        '&:hover': {
                          backgroundColor: theme.palette.error.light,
                          color: theme.palette.error.contrastText
                        }
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemButton>
            </Paper>
          )})}
        </Box>
      )}

      {legacyDbs.length > 0 && (
        <Box sx={{ mt: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="h6" color="warning.main" gutterBottom>
            Legacy Databases Detected
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We found some older databases on the server. Import them to your workspace to use them.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: 'repeat(auto-fit, 300px)',
              justifyContent: 'center',
              justifyItems: 'center',
              width: '100%'
            }}
          >
            {legacyDbs.map(file => (
              <Paper
                key={file}
                elevation={1}
                sx={{
                  borderRadius: 1,
                  bgcolor: theme.palette.background.paper,
                  p: 2,
                  width: '300px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Typography variant="body2" noWrap sx={{ flexGrow: 1, mr: 2 }}>{file}</Typography>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => handleImportLegacy(file)}
                  disabled={isImporting}
                >
                  Import
                </Button>
              </Paper>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
