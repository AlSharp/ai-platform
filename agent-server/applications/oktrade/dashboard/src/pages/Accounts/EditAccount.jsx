import { useState, useEffect } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/context/appState";
import { useAuthFetch } from "@/lib/fetch";
import { notifications } from '@mantine/notifications';
import { buildNotificationError, buildNotificationSuccess } from "@/lib/utils";

import {
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
  Stepper,
  Table,
  Badge,
  Center,
  Collapse,
  Alert,
  UnstyledButton
} from '@mantine/core';
import { useDisclosure } from "@mantine/hooks";
import { CircleCrossIcon, AlertTriangleIcon, ChevronLeftIcon } from '@/components/icons';

import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useForm } from '@mantine/form';
import { useUIConfigSelector } from "@/context/uiConfig";
import { cn, getBrokersListByAccountType } from '@/lib/utils';

import Page from '@/layout/Page';

const getLiveTradingClientList = (clients, account) => {
  return clients
    .filter(client => client.brokerName === account.brokerName)
    .map(client => ({ label: client.name, value: client.id.toString() }))
}

const getStrategiesList = (strategies) => {
  return strategies
    .filter(strategy => strategy.accountId === null)
    .map(strategy => ({ label: strategy.name, value: strategy.id.toString() }))
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

const renderAlert = (clients, message) => {
  if (clients.length) return null;
  return <Alert variant="light" color="orange" className="py-3 px-3 mt-4" icon={<AlertTriangleIcon />}>
    { message }
  </Alert>
}

function EditAccount() {
  const _fetch = useAuthFetch();
  const [appState, setAppState] = useAppState();

  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const initialAccountData = location.state?.account;

  const accountTypes = useUIConfigSelector('dropdown_options', 'account_types');
  const brokers = useUIConfigSelector('dropdown_options', 'brokers');

  const [active, setActive] = useState(0);
  const nextStep = () => {
    close();
    setActive((current) => (current < 4 ? current + 1 : current));
  };
  const prevStep = () => {
    close();
    setActive((current) => (current > 0 ? current - 1 : current));
    setStepError(0);
  };

  const [opened, { open, close }] = useDisclosure();
  const [addClientEnabled, setAddClientEnabled] = useState(false);
  const [addStrategyEnabled, setAddStrategyEnabled] = useState(false);

  const [stepError, setStepError] = useState(0);
  const [editing, setEditing] = useState(false);

  const [brokersList, setBrokersList] = useState(getBrokersListByAccountType(brokers, 'livetrading'));
  const [strategiesList, setStrategiesList] = useState([]);

  const schema1 = z.object({
    name: z
      .string({
        required_error: "Account number is required",
        invalid_type_error: "Account number must be a string"
      })
      .min(2, { message: 'Name should have at least 2 characters' })
      .max(30, { message: 'Should be no more than 30 characters' }),
    type: z.enum(accountTypes.map(type => type.value)),
    description: z
      .string()
      .max(255, { message: 'Should be no more than 30 characters' })
      .nullable(),
    brokerName: z.enum(brokers.map(broker => broker.value), {
      errorMap: () => ({ message: 'Broker name is required' })
    }),
    accountNumber: z
      .string({
        required_error: "Account number is required",
        invalid_type_error: "Account number must be a string"
      })
      .max(30, { message: 'Should be no more than 30 characters' })
  });

  const form1 = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      type: 'livetrading',
      description: null,
      brokerName: null,
      accountNumber: null
    },
    validate: zodResolver(schema1),
    validateInputOnBlur: true,
    transformValues: values => ({
      ...values,
      description: values.description ? values.description : null,
      brokerName: values.brokerName ? values.brokerName : null,
      accountNumber: values.accountNumber ? values.accountNumber : null
    })
  })

  form1.watch('type', ({ previousValue, value }) => {
    if (previousValue !== value) {
      setBrokersList(getBrokersListByAccountType(brokers, value));
      form1.setFieldValue('brokerName', null);
    }
  })

  const schema2 = z.object({
    liveTradingClient: z
      .enum(appState.liveTradingClients.map(client => client.id.toString()))
      .nullable(),
  });

  const form2 = useForm({
    mode: 'uncontrolled',
    initialValues: {
      liveTradingClient: null
    },
    validate: zodResolver(schema2),
    validateInputOnBlur: true,
    transformValues: values => ({
      ...values,
      liveTradingClient: values.liveTradingClient ? values.liveTradingClient : null,
    }),
    onValuesChange: values => {
      setAddClientEnabled(!!values.liveTradingClient)
    }
  })

  const schema3 = z.object({
    strategy: z
      .enum(appState.strategies.map(client => client.id.toString()))
      .nullable(),
  });

  const form3 = useForm({
    mode: 'uncontrolled',
    initialValues: {
      strategy: null
    },
    validate: zodResolver(schema3),
    validateInputOnBlur: true,
    transformValues: values => ({
      ...values,
      strategy: values.strategy ? values.strategy : null,
    }),
    onValuesChange: values => {
      setAddStrategyEnabled(!!values.strategy)
    }
  })

  useEffect(() => {
    if (!initialAccountData) {
      getAccount(id);
    } else {
      form1.setValues(initialAccountData);
    }
  }, [])

  useEffect(() => {
    if (active === 1) {
      if (appState.liveTradingClients.length === 0) {
        getLiveTradingClients();
      }
    }
    if (active === 2) {
      if (strategiesList.length === 0) {
        getStrategies().then(setStrategiesList);
      }
    }
  }, [active])

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

  const getAccount = async (id) => {
    try {
      const { data: account } = await _fetch.get(`/core/accounts/${id}`);
      form1.setValues(account);
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

  const editAccount = async () => {
    try {
      setEditing(true);
      const account = form1.getValues();
      const strategyIds = strategiesList
        .filter(strategy => strategy.accountId === account.id)
        .map(strategy => strategy.id);
      nextStep();
      const { message } = await _fetch.put(`/core/accounts/${id}`, { account, strategyIds });
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => {
          navigate(`/accounts/${account.id}`);
        }
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
      setStepError(4);
    }
    finally {
      setEditing(false);
    }
  }

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

  const addLiveTradingClient = () => {
    const { liveTradingClient } = form2.getValues();
    form1.setValues({ liveTradingClientId: +liveTradingClient });
    close();
  }

  const removeLiveTradingClient = () => {
    form1.setValues({ liveTradingClientId: null });
    form2.setValues({ liveTradingClient: null });
  }

  const NoClients = () => <Center>
    No client linked to account.
    <Button
      variant="transparent"
      className="px-0 ml-2"
      onClick={open}
    >
      Add client
    </Button>
  </Center>

  const NoStrategies = () => <Center>
    No strategies linked to account.
    <Button
      variant="transparent"
      className="px-0 ml-2"
      onClick={open}
    >
      Add strategy
    </Button>
  </Center>

  const AddOneMoreStrategy = () => <Center>
    <Button
      variant="transparent"
      className="px-0 ml-2"
      onClick={open}
    >
      Add Strategy
    </Button>
  </Center>

  const renderLiveTradingClients = () => {

    const clients = appState.liveTradingClients;
    const account = form1.getValues();

    const rows = clients.filter(client => client.id === account?.liveTradingClientId).map((client) => {

      return (
        <Table.Tr key={client.id}>
          <Table.Td className="align-top leading-9">{client.name}</Table.Td>
          <Table.Td className="align-top leading-9">{client.brokerName}</Table.Td>
          <Table.Td className="align-top leading-9">{client.port}</Table.Td>
          <Table.Td className="align-top leading-9">{getClientStatus(client)}</Table.Td>
          <Table.Td className="align-top">
            <Group>
              <Button
                variant="transparent"
                className="px-0 ml-2"
                onClick={removeLiveTradingClient}
              >
                Remove
              </Button>
            </Group>
          </Table.Td>
        </Table.Tr>
      )
    })

    return (
      <>
        <Table.ScrollContainer minWidth={500} className="mt-3">
          <Table highlightOnHover>
            <Table.Thead className="bg-gray-200">
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Broker</Table.Th>
                <Table.Th>Port</Table.Th>
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

  const addStrategy = () => {
    const account = form1.getValues();
    const { strategy } = form3.getValues();
    setStrategiesList(list => list.map(str => {
      if (str.id == strategy) return { ...str, accountId: account.id };
      return str;
    }))
    form3.setValues({ strategy: null })
    close();
  }

  const removeStrategy = (strategy) => {
    setStrategiesList(list => list.map(str => {
      if (str.id === strategy.id) {
        return { ...str, accountId: null }
      }
      return str;
    }));
    form3.setValues({ strategy: null })
  }

  const renderStrategies = () => {

    const account = form1.getValues();

    const rows = strategiesList.filter(strategy => strategy.accountId === account?.id).map((strategy) => {

      return (
        <Table.Tr key={strategy.id}>
          <Table.Td className="align-top leading-9">{strategy.name}</Table.Td>
          <Table.Td className="align-top leading-9">{strategy.description}</Table.Td>
          <Table.Td className="align-top leading-9">{strategy.type}</Table.Td>
          <Table.Td className="align-top leading-9">{strategy.file}</Table.Td>
          <Table.Td className="align-top">
            <Group>
              <Button
                variant="transparent"
                className="px-0 ml-2"
                onClick={() => removeStrategy(strategy)}
              >
                Remove
              </Button>
            </Group>
          </Table.Td>
        </Table.Tr>
      )
    })

    return (
      <>
        <Table.ScrollContainer minWidth={500} className="mt-3">
          <Table highlightOnHover>
            <Table.Thead className="bg-gray-200">
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>File</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {
          rows.length === 0 ? <NoStrategies /> : <AddOneMoreStrategy />
        }
      </>
    )
  }

  return (
    <Page className="2xl:w-1/2 xl:w-3/4">
      <Link to="/accounts" className="flex items-center w-fit pr-3 py-1 mb-4 rounded-md hover:bg-gray-100">
        <ChevronLeftIcon />
        <UnstyledButton>
          Back to Accounts
        </UnstyledButton>
      </Link>
      <h1 className="text-3xl font-semibold">Edit account</h1>
      <div className="p-4">
      <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 1 })}
            label="Account"
            description="edit general settings"
            color={stepError === 1 ? 'red' : undefined}
            icon={stepError === 1 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <form onSubmit={form1.onSubmit(nextStep)}>
              <TextInput
                className="mb-2"
                withAsterisk
                required
                label="Account Name"
                placeholder="Account Name"
                key={form1.key('name')}
                {...form1.getInputProps('name')}
              />
              <Select
                className="mb-2"
                withAsterisk
                required
                label="Account Type"
                placeholder="Account Type"
                data={accountTypes}
                allowDeselect={false}
                key={form1.key('type')}
                {...form1.getInputProps('type')}
              />
              <Textarea
                className="mb-2"
                placeholder="Description..."
                label="Account Description"
                autosize
                minRows={2}
                radius="sm"
                key={form1.key('description')}
                {...form1.getInputProps('description')}
              />
              <Select
                className="mb-2"
                withAsterisk
                required
                label="Broker Name"
                placeholder="Broker Name"
                data={brokersList}
                allowDeselect={true}
                key={form1.key('brokerName')}
                {...form1.getInputProps('brokerName')}
              />
              <TextInput
                className="mb-2"
                label="Account Number"
                placeholder="Account Number"
                key={form1.key('accountNumber')}
                {...form1.getInputProps('accountNumber')}
              />
              <Group className="mt-6 justify-end">
                <Button className="px-8" type="submit">
                  Next
                </Button>
              </Group>
            </form>
          </Stepper.Step>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 2 })}
            label="Live Trading Client"
            description="add or remove API client"
            color={stepError === 2 ? 'red' : undefined}
            icon={stepError === 2 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <form onSubmit={form2.onSubmit(nextStep)}>
              { renderLiveTradingClients() }
              <Collapse in={opened}>
                <Group className="items-center">
                  <Select
                    className="mb-2"
                    label="Select Client"
                    placeholder="Client Name"
                    data={getLiveTradingClientList(appState.liveTradingClients, form1.getValues())}
                    allowDeselect={true}
                    key={form2.key('liveTradingClient')}
                    {...form2.getInputProps('liveTradingClient')}
                  />
                  <Button className="px-8 mt-4" onClick={addLiveTradingClient} disabled={!addClientEnabled}>
                    Add
                  </Button>
                  { renderAlert(getLiveTradingClientList(appState.liveTradingClients, form1.getValues()), 'No clients found for selected broker!') }
                </Group>
              </Collapse>
              <Group className="mt-6 justify-end">
                <Button className="px-8" onClick={prevStep}>
                  Back
                </Button>
                <Button className="px-8" type="submit">
                  Next
                </Button>
              </Group>
            </form>
          </Stepper.Step>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 3 })}
            label="Strategy"
            description="add or remove strategies"
            color={stepError === 3 ? 'red' : undefined}
            icon={stepError === 3 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <form onSubmit={form3.onSubmit(nextStep)}>
              { renderStrategies() }
              <Collapse in={opened}>
                <Group className="items-center">
                  <Select
                    className="mb-2"
                    label="Select Strategy"
                    placeholder="Strategy Name"
                    data={getStrategiesList(strategiesList)}
                    allowDeselect={true}
                    key={form3.key('strategy')}
                    {...form3.getInputProps('strategy')}
                  />
                  <Button className="px-8 mt-4" onClick={addStrategy} disabled={!addStrategyEnabled}>
                    Add
                  </Button>
                  { renderAlert(getStrategiesList(strategiesList), 'No unlinked strategies found!') }
                </Group>
              </Collapse>
              <Group className="mt-6 justify-end">
                <Button className="px-8" onClick={prevStep}>
                  Back
                </Button>
                <Button className="px-8" type="submit">
                  Next
                </Button>
              </Group>
            </form>
          </Stepper.Step>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 4 })}
            label="Edit"
            description="save changes"
            loading={editing}
            color={stepError === 4 ? 'red' : undefined}
            icon={stepError === 4 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <p>Proceed with changes by clicking on Edit button. To cancel click on Back to Accounts.</p>
            <Group className="mt-6 justify-end">
              <Button className="px-8" onClick={editAccount}>
                Edit
              </Button>
            </Group>
          </Stepper.Step>
          <Stepper.Completed>
            Account has been edited successfully!
          </Stepper.Completed>
        </Stepper>
      </div>
    </Page>
  )
}

export default EditAccount;