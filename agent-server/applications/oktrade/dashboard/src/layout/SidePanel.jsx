import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardIcon,
  AccountIcon,
  StrategyIcon,
  JournalIcon,
  ReportIcon,
  SettingsIcon,
  LiveTradingClientIcon,
  LogoutIcon
} from '@/components/icons';
import { useAuth } from '@/context/auth';
import { useAuthFetch } from '@/lib/fetch';
import { UnstyledButton } from '@mantine/core';
import { cn } from '@/lib/utils';

const menuItems = [
  { link: '/', label: 'Dashboard', icon: DashboardIcon },
  { link: '/accounts', label: 'Accounts', icon: AccountIcon },
  { link: '/strategies', label: 'Strategies', icon: StrategyIcon },
  { link: '/journals', label: 'Journals', icon: JournalIcon },
  { link: '/reports', label: 'Reports', icon: ReportIcon },
];

const bottomMenuItems = [
  { link: '/settings', label: 'Settings' },
]

function SidePanel() {

  const location = useLocation();
  const path = '/' + location.pathname.split('/')[1];
  const menuItem = menuItems.concat(bottomMenuItems).find(item => item.link === path)?.label;

  const [active, setActive] = useState(menuItem);

  const navigate = useNavigate();
  const { setToken } = useAuth();
  const _fetch = useAuthFetch();

  const logout = async() => {
    try {
      await _fetch.post('/logout', {
        username: 'elistaphilly'
      });
      setToken(null);
      navigate('/');
    }
    catch(error) {
      console.log(error);
    }
  }

  useEffect(() => {
    setActive(menuItem);
  }, [location.pathname])

  return (
    <>
      <div className="pt-2">
        {
          menuItems.map((item) => (
            <Link
              key={item.label}
              className={cn("flex items-center font-semibold text-sm rounded px-4 py-2", { 'bg-blue-100': active === item.label, 'hover:bg-gray-100': active !== item.label, 'hover:bg-blue-100': active === item.label })}
              to={item.link}
            >
              <item.icon wrapperClassName="mr-4" className={cn("text-gray-600 w-8 h-8", { 'text-blue-500': active === item.label })} stroke={1.5} />
              <span className={cn("text-gray-600", { 'text-blue-500': active === item.label })}>{item.label}</span>
            </Link>
          ))
        }
      </div>

      <div>
        <Link to="/settings">
          <UnstyledButton className={cn("flex w-full items-center font-semibold text-sm rounded px-4 py-2", { 'bg-blue-100': active === 'Settings', 'hover:bg-gray-100': active !== 'Settings', 'hover:bg-blue-100': active === 'Settings' })}>
            <SettingsIcon className="text-gray-600 mr-4 w-8 h-8" />
            <span>Settings</span>
          </UnstyledButton>
        </Link>
        <UnstyledButton className={cn("flex w-full items-center font-semibold text-sm rounded px-4 py-2 hover:bg-gray-100")} onClick={logout}>
          <LogoutIcon className="text-gray-600 mr-4 w-8 h-8" />
          <span>Logout</span>
        </UnstyledButton>
      </div>
    </>
  )
}

export default SidePanel;