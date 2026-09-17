import { useEffect, type FC, type PropsWithChildren } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../state/configureStore';
import { setAuth } from '../state/authSlice';
import { setDbReady, disableLoading } from '../state/pageSlice';
import { isWebMode } from '../shared/api/restApi';
import { SpinnerOverlay } from '../shared/components/feedback/spinner/SpinnerOverlay';

export const ProtectedRoute: FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isInitialized } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isInitialized) {
      if (isWebMode()) {
        fetch('/api/auth/me', {
          headers: { 'Accept': 'application/json' }
        })
          .then(res => res.json())
          .then(data => {
            dispatch(disableLoading());
            if (data.success && data.data) {
              dispatch(setAuth(data.data));

              if (data.data.databaseSelectionRequired) {
                // Do nothing to dbReady, just redirect
                if (location.pathname !== '/select-database') {
                  navigate('/select-database', { replace: true });
                }
              } else if (data.data.validDbCount >= 1) {
                // Only 1 DB or it was already selected/opened by backend
                dispatch(setDbReady(true));
              }
            } else {
              dispatch(setAuth(null));
            }
          })
          .catch(() => {
             dispatch(disableLoading());
             dispatch(setAuth(null));
          });
      } else {
        // In electron, no login needed yet unless they set it up.
        // For now, offline electron just proceeds.
        dispatch(setAuth({ userId: 'offline', workspaceId: 'offline', username: 'offline', email: 'offline' }));
        dispatch(setDbReady(true));
      }
    }
  }, [isInitialized, dispatch, navigate, location.pathname]);

  if (!isInitialized) {
    return <SpinnerOverlay />;
  }

  if (!isAuthenticated && isWebMode()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
