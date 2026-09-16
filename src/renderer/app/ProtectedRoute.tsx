import { useEffect, type FC, type PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../state/configureStore';
import { setAuth, setInitialized } from '../state/authSlice';
import { isWebMode } from '../shared/api/restApi';
import { SpinnerOverlay } from '../shared/components/feedback/spinner/SpinnerOverlay';

export const ProtectedRoute: FC<PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isInitialized } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  const location = useLocation();

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
            } else {
              dispatch(setAuth(null));
            }
          })
          .catch(() => {
             dispatch(setAuth(null));
          });
      } else {
        // In electron, no login needed yet unless they set it up.
        // For now, offline electron just proceeds.
        dispatch(setAuth({ userId: 'offline', workspaceId: 'offline', username: 'offline', email: 'offline' }));
      }
    }
  }, [isInitialized, dispatch]);

  if (!isInitialized) {
    return <SpinnerOverlay />;
  }

  if (!isAuthenticated && isWebMode()) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
