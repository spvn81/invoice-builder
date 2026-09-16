import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

export interface ElectronProfile {
  profileId: string;
}

let cachedProfile: ElectronProfile | null = null;

export const getLocalProfile = (): ElectronProfile => {
  if (cachedProfile) return cachedProfile;
  
  const userDataPath = app.getPath('userData');
  const profilePath = path.join(userDataPath, 'profile.json');

  if (fs.existsSync(profilePath)) {
    try {
      const data = fs.readFileSync(profilePath, 'utf8');
      cachedProfile = JSON.parse(data);
      if (cachedProfile?.profileId) {
        return cachedProfile;
      }
    } catch (e) {
      console.error('Failed to read profile.json', e);
    }
  }

  // Generate new profile
  cachedProfile = {
    profileId: uuidv4()
  };

  fs.writeFileSync(profilePath, JSON.stringify(cachedProfile, null, 2), 'utf8');
  return cachedProfile;
};
