import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "@/context/appState";
import { useAuthFetch } from "@/lib/fetch";
import { notifications } from '@mantine/notifications';
import { buildNotificationError, buildNotificationSuccess } from "@/lib/utils";
import { useUIConfigSelector } from "@/context/uiConfig";
import Page from '@/layout/Page';

import {
  Card,
  Button,
  Menu,
  ActionIcon,
  rem
} from '@mantine/core';
import { DotsIcon, EditIcon, RemoveIcon, SingleJournalIcon } from "@/components/icons";

function Strategies() {
  const _fetch = useAuthFetch();

  const [appState, setAppState] = useAppState();

  useEffect(() => {
    getStrategies();
    getStrategyFiles();
  }, []);

  const getStrategies = async () => {
    try {
      const { data: strategies } = await _fetch.get('/core/strategies');
      setAppState({ strategies });
      return strategies;
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const getStrategyFiles = async () => {
    try {
      const { data: strategyFiles } = await _fetch.get('/core/strategyfiles');
      setAppState({ strategyFiles });
      return strategyFiles;
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const deleteStrategy = async (id) => {
    try {
      const { message } = await _fetch.delete(`/core/strategies/${id}`);
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => getStrategies().then(strategies => setAppState({ strategies }))
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  const renderStrategies = () => {
    const strategies = appState.strategies;
    if(!strategies.length) return <span>Strategies not found</span>
    return strategies.map(str => {
      return (
        <Card key={str.id} className=" flex flex-col w-64 h-64 justify-between mr-4 hover:shadow-lg" withBorder p="xs" radius="sm" shadow="sm">
          <div>
            <div className="flex items-center justify-between">
              <Link to={`/strategies/${str.id}`}>
                <h3 className="font-semibold truncate mr-1 underline text-blue-700 hover:text-blue-500">{str.name}</h3>
              </Link>
              <div className="mb-auto">
                <Menu shadow="xs" width={200}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" aria-label="strategy menu">
                      <DotsIcon className="text-gray-600 w-4 h-4" style={{ width: rem(16), height: rem(16) }} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Link to={`/strategies/${str.id}/edit`}>
                      <Menu.Item leftSection={<EditIcon style={{ width: rem(14), height: rem(14) }} />}>
                        Edit
                      </Menu.Item>
                    </Link>
                    <Link to={`/strategies/${str.id}/journal`}>
                      <Menu.Item leftSection={<SingleJournalIcon style={{ width: rem(14), height: rem(14) }} />}>
                        Read Journal
                      </Menu.Item>
                    </Link>

                    <Menu.Divider />

                    <Menu.Label className="text-red-700">Danger zone</Menu.Label>

                    <Menu.Item
                      leftSection={<RemoveIcon style={{ width: rem(14), height: rem(14) }} />}
                      onClick={() => deleteStrategy(str.id)}
                    >
                      Delete Strategy
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </div>
            </div>
          </div>
        </Card>
      )
    })
  }

  return (
    <Page>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">Strategies</h1>
        <Link to="/strategies/add">
          <Button size="sm" color="green" className="ml-4">New Strategy</Button>
        </Link>
      </div>
      <div className="mb-8">
        <div className="flex">
          { renderStrategies() }
        </div>
      </div>
    </Page>
  )
}

export default Strategies;