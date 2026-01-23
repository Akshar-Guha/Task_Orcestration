'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { 
  getDeviceToken, 
  saveDeviceToken, 
  generateDeviceToken, 
  isDeviceAuthorized,
  registerDevice 
} from '@/lib/deviceAuth';
import { PinGate } from './PinGate';

interface DeviceAuthContextType {
  isAuthorized: boolean;
  isLoading: boolean;
}

const DeviceAuthContext = createContext<DeviceAuthContextType>({
  isAuthorized: false,
  isLoading: true,
});

export const useDeviceAuth = () => useContext(DeviceAuthContext);

interface DeviceAuthProviderProps {
  children: React.ReactNode;
}

export function DeviceAuthProvider({ children }: DeviceAuthProviderProps) {
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Landing page is publicly accessible - bypass auth immediately
  const isLandingPage = pathname === '/';
  
  // Don't show loading for landing page since it's public
  const [isLoading, setIsLoading] = useState(!isLandingPage);

  useEffect(() => {
    // Skip auth check entirely for landing page
    if (isLandingPage) {
      return;
    }

    async function checkAuth() {
      const token = getDeviceToken();
      
      if (!token) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }
      
      // Validate token against database
      const authorized = await isDeviceAuthorized(token);
      setIsAuthorized(authorized);
      setIsLoading(false);
    }
    
    checkAuth();
  }, [isLandingPage]);

  const handlePinSuccess = useCallback(async () => {
    const token = generateDeviceToken();
    
    // Register in database
    const registered = await registerDevice(token);
    
    if (registered) {
      saveDeviceToken(token);
      setIsAuthorized(true);
    }
  }, []);

  // Landing page is publicly accessible - bypass auth
  if (isLandingPage) {
    return (
      <DeviceAuthContext.Provider value={{ isAuthorized: true, isLoading: false }}>
        {children}
      </DeviceAuthContext.Provider>
    );
  }

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">
          <div className="text-4xl mb-4">🔄</div>
          <div>Verifying device...</div>
        </div>
      </div>
    );
  }

  // Show PIN gate if not authorized
  if (!isAuthorized) {
    return <PinGate onSuccess={handlePinSuccess} />;
  }

  // Authorized - render children
  return (
    <DeviceAuthContext.Provider value={{ isAuthorized, isLoading }}>
      {children}
    </DeviceAuthContext.Provider>
  );
}
