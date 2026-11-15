import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { useAppState } from "@/context/appState";
import { useAuthFetch } from "@/lib/fetch";
import { useUIConfigSelector } from "@/context/uiConfig";

import { UnstyledButton } from "@mantine/core";
import { ChevronLeftIcon } from "@/components/icons";

import Page from '@/layout/Page';


function Account() {
  const _fetch = useAuthFetch();
  const [appState, setAppState] = useAppState();
  
  const location = useLocation();
  const { id } = useParams();
  const initialAccountData = location.state?.account;

  const [account, setAccount] = useState(initialAccountData || null);

  const accountTypes = useUIConfigSelector('dropdown_options', 'account_types');

  useEffect(() => {
    if (!account) {
      getAccount(id);
    }
  }, [])

  const getAccount = async (id) => {
    try {
      const { data: account } = await _fetch.get(`/core/accounts/${id}`);
      setAccount(account);
      console.log(account);
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api',  {
        autoClose: 3000,
        onClose: () => {
          navigate('/accounts')
        }
      }));
    }
  }

  const getAccountTitle = (account) => {
    if (!account) return null;
    const accountTypeLabel = accountTypes.find(type => type.value === account.type)?.label || '';
    const accountName = account.name;

    return `${accountTypeLabel} - ${accountName}`;
  }

  return (
    <Page>
      <Link to="/accounts" className="flex items-center w-fit pr-3 py-1 mb-4 rounded-md hover:bg-gray-100">
        <ChevronLeftIcon />
        <UnstyledButton>
          Back to Accounts
        </UnstyledButton>
      </Link>
      <h1 className="text-3xl font-semibold">{ getAccountTitle(account) }</h1>
    </Page>
  )
}

export default Account;