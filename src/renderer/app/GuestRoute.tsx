import { useEffect, type FC, type PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../state/configureStore';
import { setAuth } from '../state/authSlice';
import { isWebMode } from '../shared/api/restApi';
import { SpinnerOverlay } from '../shared/components/feedback/spinner/SpinnerOverlay';

export const GuestRoute: FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isInitialized, databaseSelectionRequired, databaseCreationRequired } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!isInitialized) {
      if (isWebMode()) {
        fetch('/api/auth/me', {
          headers: { 'Accept': 'application/json' }
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data) {
              dispatch(setAuth(data.data));
              // Note: setAuth does not currently include these fields, we will fix setAuth in authSlice next
            } else {
              dispatch(setAuth(null));
            }
          })
          .catch(() => {
             dispatch(setAuth(null));
          });
      } else {
        dispatch(setAuth({ userId: 'offline', workspaceId: 'offline', username: 'offline', email: 'offline' }));
      }
    }
  }, [isInitialized, dispatch]);

  if (!isInitialized) {
    return <SpinnerOverlay />;
  }

  if (isAuthenticated && isWebMode()) {
    if (databaseCreationRequired) {
      return <Navigate to="/create-database" replace />;
    }
    if (databaseSelectionRequired) {
      return <Navigate to="/select-database" replace />;
    }
    return <Navigate to="/invoices" replace />;
  }

  return <>{children}</>;
};
