import { type Express } from 'express';
import { initBanksController } from './banks';
import { initBusinessesController } from './businesses';
import { initCategoriesController } from './categories';
import { initClientsController } from './clients';
import { initCurrenciesController } from './currencies';
import { initImportExportController } from './importExport';
import { initInvoicesController } from './invoices';
import { initItemsController } from './items';
import { initLayoutsController } from './layouts';
import { initPresetsController } from './presets';
import { initSettingsController } from './settings';
import { initStyleProfilesController } from './styleProfiles';
import { initUnitsController } from './units';
import { authMiddleware } from '../middlewares/authMiddleware';

export const initControllers = (app: Express) => {
  // Apply auth middleware to all business routes
  app.use('/api/import-export', authMiddleware);
  app.use('/api/layouts', authMiddleware);
  app.use('/api/businesses', authMiddleware);
  app.use('/api/categories', authMiddleware);
  app.use('/api/clients', authMiddleware);
  app.use('/api/invoices', authMiddleware);
  app.use('/api/items', authMiddleware);
  app.use('/api/settings', authMiddleware);
  app.use('/api/style-profiles', authMiddleware);
  app.use('/api/units', authMiddleware);
  app.use('/api/currencies', authMiddleware);
  app.use('/api/banks', authMiddleware);
  app.use('/api/presets', authMiddleware);

  initImportExportController(app);
  initLayoutsController(app);
  initBusinessesController(app);
  initCategoriesController(app);
  initClientsController(app);
  initInvoicesController(app);
  initItemsController(app);
  initSettingsController(app);
  initStyleProfilesController(app);
  initUnitsController(app);
  initCurrenciesController(app);
  initBanksController(app);
  initPresetsController(app);
};
