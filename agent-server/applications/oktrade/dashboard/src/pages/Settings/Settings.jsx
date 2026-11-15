import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "@/context/appState";
import { useAuthFetch } from "@/lib/fetch";
import { notifications } from '@mantine/notifications';
import { buildNotificationError, buildNotificationSuccess, cn } from "@/lib/utils";
import { useUIConfigSelector } from "@/context/uiConfig";
import Page from '@/layout/Page';

import {
  Button,
  Table,
  JsonInput,
  Group,
  Text,
  Center,
  Badge
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useGetLocalStorageValue } from "@/lib/hooks";

const NoClients = () => <Center>No clients found</Center>

function Settings() {
  const _fetch = useAuthFetch();

  const [appState, setAppState] = useAppState();

  const getCode = useGetLocalStorageValue('code', 120000);

  useEffect(() => {
    getLiveTradingClients();
  }, []);

  const getLiveTradingClients = async () => {
    try {
      const { data: liveTradingClients } = await _fetch.get('/core/live-trading-clients?with_state=true');
      setAppState({ liveTradingClients });
      return liveTradingClients;
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const editLiveTradingClient = () => null;

  const editLiveTradingClientModal = (id) => {
    modals.open({
      title: 'Edit live trading client',
      centered: true,
      children: (
        <>
          <p>Editing not supported for this item yet</p>
          <Button fullWidth onClick={() => modals.closeAll()} mt="md">
            Ok
          </Button>
        </>
      )
    });
  }

  const deleteLiveTradingClient = async (id) => {
    try {
      const { message } = await _fetch.delete(`/core/live-trading-clients/${id}`);
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => getLiveTradingClients().then(liveTradingClients => setAppState({ liveTradingClients }))
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const deleteLiveTradingClientModal = async (id) => {
    modals.openConfirmModal({
      title: 'Delete live trading client',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete live trading client?
        </Text>
      ),
      labels: { confirm: 'Yes, delete client', cancel: "No, don't delete it" },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteLiveTradingClient(id),
    });
  }

  const startClient = async (brokerName) => {
    try {
      const { message } = await _fetch.post(`/core/resources/live-trading-clients/start?brokerName=${brokerName}`);
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => getLiveTradingClients().then(liveTradingClients => setAppState({ liveTradingClients }))
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const connect = async (client) => {
    try {
      const { data: config } = await _fetch.get(`/core/resources/live-trading-clients/config?port=${client.port}`);
      window.open(config.devAuthURL, '_blank');
      const code = await getCode();
      const { message } = await _fetch.post(`/core/resources/live-trading-clients/authenticate?port=${client.port}`, { code });
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => getLiveTradingClients().then(liveTradingClients => setAppState({ liveTradingClients }))
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const disconnect = async (client) => {
    modals.open({
      title: 'Disconnect client',
      centered: true,
      children: (
        <>
          <p>Disconnecting client not supported yet</p>
          <Button fullWidth onClick={() => modals.closeAll()} mt="md">
            Ok
          </Button>
        </>
      )
    });
  }

  const getClientStatus = (client) => {
    if (client.active) {
      return client.state?.authenticated
        ? <Badge
            variant="light"
            className="mr-1 font-medium hover:bg-gray-300 hover:cursor-pointer"
            size="md"
            color="green"
          >
            Connected
          </Badge>
        : <Badge
            variant="light"
            className="mr-1 font-medium hover:bg-gray-300 hover:cursor-pointer"
            size="md"
            color="red"
          >
            Disconnected
          </Badge>;
    } else {
      return (
        <Badge
          variant="light"
          className="mr-1 font-medium hover:bg-gray-300 hover:cursor-pointer"
          size="md"
          color="dark"
        >
          Not Active
        </Badge>
      )
    }
  }

  const renderMainAction = (client) => {
    if (client.active) {
      if (client.state?.authenticated) {
        return (
          <Button variant="transparent" className="px-0" onClick={() => disconnect(client)}>
            Disconnect
          </Button>
        )
      } else {
        return (
          <Button variant="transparent" className="px-0" onClick={() => connect(client)}>
            Connect
          </Button>
        )
      }
    }
    return (
      <Button variant="transparent" className="px-0" onClick={() => startClient(client.brokerName)}>
        Start
      </Button>
    )
  }

  const renderLiveTradingClients = () => {

    const clients = appState.liveTradingClients;

    const rows = clients.map((client) => {

      const jsonConfig = client.config ? JSON.stringify(client.config) : '{}';

      const linkedAccount = client.accountId
        ? <Link to={`/accounts/${client.accountId}`}>{client.accountId}</Link>
        : 'Not linked';

      return (
        <Table.Tr key={client.id}>
          <Table.Td className="align-top leading-9">{client.name}</Table.Td>
          <Table.Td className="align-top leading-9">{client.brokerName}</Table.Td>
          <Table.Td className="align-top leading-9">{client.port}</Table.Td>
          <Table.Td><JsonInput disabled defaultValue="{}" value={jsonConfig} autosize /></Table.Td>
          <Table.Td className="align-top leading-9">{linkedAccount}</Table.Td>
          <Table.Td className="align-top leading-9">{getClientStatus(client)}</Table.Td>
          <Table.Td className="align-top">
            <Group>
              { renderMainAction(client) }
              <Button
                variant="transparent"
                className="px-0 ml-2"
                onClick={() => editLiveTradingClientModal(client.id)}
              >
                Edit
              </Button>
              <Button
                variant="transparent"
                className="px-0 ml-2"
                onClick={() => deleteLiveTradingClientModal(client.id)}
              >
                Delete
              </Button>
            </Group>
          </Table.Td>
        </Table.Tr>
      )
    })

    return (
      <>
        <Table.ScrollContainer minWidth={500}>
          <Table highlightOnHover>
            <Table.Thead className="bg-gray-200">
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Broker</Table.Th>
                <Table.Th>Port</Table.Th>
                <Table.Th>Configuration JSON</Table.Th>
                <Table.Th>Linked Account</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {
          rows.length === 0 ? <NoClients /> : null
        }
      </>
    )
  }

  return (
    <Page>
      <h1 className="text-3xl font-semibold mb-8">Settings</h1>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Live Trading Clients</h2>
          <Link to="/settings/add-live-trading-client">
            <Button size="sm" color="green" className="ml-4">Add Client</Button>
          </Link>
        </div>
        <div>
          { renderLiveTradingClients() }
        </div>
      </div>
    </Page>
  )
}

export default Settings;