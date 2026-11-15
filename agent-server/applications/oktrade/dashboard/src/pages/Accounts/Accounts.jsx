import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "@/context/appState";
import { useAuthFetch } from "@/lib/fetch";
import { notifications } from '@mantine/notifications';
import { buildNotificationError, buildNotificationSuccess, getStrategiesByAccountId } from "@/lib/utils";
import { useUIConfigSelector } from "@/context/uiConfig";
import Page from '@/layout/Page';
import {
  Card,
  Button,
  Modal,
  Menu,
  Badge,
  ActionIcon,
  LoadingOverlay,
  Tooltip,
  Text,
  rem
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useDisclosure } from "@mantine/hooks";

import NewAccountForm from "./NewAccountForm";
import { DotsIcon, EditIcon, RemoveIcon, StrategyIcon, InfoIcon } from "@/components/icons";

function Accounts() {
  const _fetch = useAuthFetch();

  const accountTypes = useUIConfigSelector('dropdown_options', 'account_types');

  const [appState, setAppState] = useAppState();
  const [modalType, setModalType] = useState(null);
  const [modalOpened, { open: openModal, close: _closeModal }] = useDisclosure(false);

  useEffect(() => {
    getAccounts()
  }, []);

  const openNewAccountModal = () => {
    setModalType('new_account');
    openModal();
  }

  const closeModal = () => {
    setModalType(null);
    _closeModal();
  }

  const getAccounts = async () => {
    try {
      const { data: accounts } = await _fetch.get('/core/accounts');
      setAppState({ accounts });
      return accounts;
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const createAccount = async (data) => {
    try {
      closeModal();
      setAppState({ screenLoading: true });
      const { message } = await _fetch.post('/core/accounts', data);
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => getAccounts().then(accounts => setAppState({ accounts }))
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
    finally {
      setAppState({ screenLoading: false });
    }
  }

  const deleteAccount = async (id) => {
    try {
      const { message } = await _fetch.delete(`/core/accounts/${id}`);
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => getAccounts().then(accounts => setAppState({ accounts }))
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const deleteAccountModal = async (id) => {
    modals.openConfirmModal({
      title: 'Delete account',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete account?
        </Text>
      ),
      labels: { confirm: 'Yes, delete account', cancel: "No, don't delete it" },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteAccount(id),
    });
  }

  const renderAccounts = (type) => {
    const accounts = appState.accounts.filter(acc => acc.type === type);
    if (!accounts.length) return <span>Accounts not found</span>
    return accounts.map(acc => {
      const badgeLabel = accountTypes.find(type => type.value === acc.type)?.value || 'Unknown';
      const badgeColor = accountTypes.find(type => type.value === acc.type)?.color || 'gray';

      return (
        <Card key={acc.id} className=" flex flex-col w-64 h-64 justify-between mr-4 hover:shadow-lg" withBorder p="xs" radius="sm" shadow="sm">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex">
                <Link
                  to={`/accounts/${acc.id}`}
                  state={{ account: acc}}
                  className="hover:cursor-pointer"
                >
                  <h3 className="font-semibold truncate mr-1 underline text-blue-700 hover:text-blue-500 max-w-44">{acc.name}</h3>
                </Link>
                <Tooltip label={acc.description}>
                  <InfoIcon className="w-4 h-4 text-blue-500 hover:cursor-pointer hover:text-blue-600" />
                </Tooltip>
              </div>
              <div className="mb-auto">
                <Menu shadow="xs" width={200}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" aria-label="account menu">
                      <DotsIcon className="text-gray-600 w-4 h-4" style={{ width: rem(16), height: rem(16) }} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Link
                      to={`/accounts/${acc.id}/edit`}
                      state={{ account: acc }}
                    >
                      <Menu.Item leftSection={<EditIcon style={{ width: rem(14), height: rem(14) }} />}>
                        Edit
                      </Menu.Item>
                    </Link>
                    <Link to={`/accounts/${acc.id}/strategies`}>
                      <Menu.Item leftSection={<StrategyIcon style={{ width: rem(14), height: rem(14) }} />}>
                        View Strategies
                      </Menu.Item>
                    </Link>

                    <Menu.Divider />

                    <Menu.Label className="text-red-700">Danger zone</Menu.Label>

                    <Menu.Item
                      leftSection={<RemoveIcon style={{ width: rem(14), height: rem(14) }} />}
                      onClick={() => deleteAccountModal(acc.id)}
                    >
                      Delete Account
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </div>
            </div>
            <div>
              <Badge size="xs" color={badgeColor}>{ badgeLabel }</Badge>
            </div>
          </div>
          { renderAccountStrategies(acc) }
        </Card>
      )
    })
  }

  const renderAccountStrategies = (acc) => {
    const strategies = getStrategiesByAccountId(appState.strategies, acc.id);
    if (!strategies.length) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-500 mb-1">Strategies</h4>
        <div className="flex flex-wrap gap-2 max-h-14 overflow-hidden">
          {
            strategies.map(strategy => (
              <Badge
                key={strategy.id}
                variant="light"
                className="mr-1 font-medium hover:bg-gray-300 hover:cursor-pointer"
                size="md"
                color="dark"
              >
                { strategy.name }
              </Badge>
            ))
          }
        </div>
      </div>
    )
  }

  const renderModal = () => {
    if (!modalType) return null;
    if (modalType === 'new_account') return <NewAccountForm close={closeModal} submit={createAccount} />
  }

  return (
    <Page>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">Accounts</h1>
        <Button size="sm" color="green" className="ml-4" onClick={openNewAccountModal}>New Account</Button>
      </div>
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Live Trading</h2>
        </div>
        <div className="flex">
          { renderAccounts('livetrading') }
        </div>
      </div>
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Forward Testing</h2>
        </div>
        <div className="flex">
          { renderAccounts('forwardtesting') }
        </div>
      </div>
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Back Testing</h2>
        </div>
        <div className="flex">
          { renderAccounts('backtesting') }
        </div>
      </div>
      <Modal opened={modalOpened} onClose={closeModal} withCloseButton={false} centered>
        <LoadingOverlay
          visible={appState.sectionLoading}
          zIndex={1000}
          overlayProps={{ radius: "sm", blur: 2 }}
        />
        { renderModal() }
      </Modal>
    </Page>
  )
}

export default Accounts;