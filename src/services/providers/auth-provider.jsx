import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState({
    profile: null,
    session: null,
  });
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserInfo((prevUserInfo) => ({ ...prevUserInfo, session }));
      supabase.auth.onAuthStateChange((_event, session) => {
        setUserInfo({ session, profile: null });
      });
    });
  }, []);

  useEffect(() => {
    if (userInfo.session?.user && !userInfo.profile) {
      listenToUserProfileChanges(userInfo.session.user.id).then((newChannel) => {
        if (channel) {
          channel.unsubscribe();
        }
        setChannel(newChannel);
      });
    } else if (!userInfo.session?.user) {
      channel?.unsubscribe();
      setChannel(null);
    }
  }, [userInfo.session]);

  async function listenToUserProfileChanges(userId) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .filter('user_id', 'eq', userId);
    if (data?.[0]) {
      setUserInfo((prevUserInfo) => ({ ...prevUserInfo, profile: data?.[0] }));
    }
    return supabase
      .channel(`public:user_profiles`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setUserInfo((prevUserInfo) => ({
            ...prevUserInfo,
            profile: payload.new,
          }));
        }
      )
      .subscribe();
  }

  return <AuthContext.Provider value={userInfo}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};