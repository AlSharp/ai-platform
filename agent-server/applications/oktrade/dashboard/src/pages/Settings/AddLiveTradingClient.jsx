import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthFetch } from "@/lib/fetch";
import { notifications } from '@mantine/notifications';
import { buildNotificationError, buildNotificationSuccess } from "@/lib/utils";
import Page from '@/layout/Page';

import {
  TextInput,
  Select,
  Button,
  Group,
  UnstyledButton,
  Stepper,
  NumberInput,
} from '@mantine/core';
import { ChevronLeftIcon, CircleCrossIcon } from '@/components/icons';

import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useForm } from '@mantine/form';
import { useUIConfigSelector } from '@/context/uiConfig';

import { cn, getZodSchema, getFormInitialValues } from '@/lib/utils';
import { useGetLocalStorageValue } from '@/lib/hooks';

function AddLiveTradingClient() {
  const _fetch = useAuthFetch();

  const brokers = useUIConfigSelector('dropdown_options', 'brokers');

  const [active, setActive] = useState(0);
  const nextStep = () => {
    setActive((current) => (current < 3 ? current + 1 : current));
  };
  const prevStep = () => {
    setActive((current) => (current > 0 ? current - 1 : current));
    setStepError(0);
  };
  const [stepError, setStepError] = useState(0);

  const [findingClient, setFindingClient] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [configSchema, setConfigSchema] = useState(null);

  const getCode = useGetLocalStorageValue('code', 120000);

  const schema1 = z.object({
    name: z
      .string({
        required_error: "Name is required",
        invalid_type_error: "Name must be a string"
      })
      .min(2, { message: 'Name should have at least 2 characters' })
      .max(30, { message: 'Should be no more than 30 characters' }),
    brokerName: z.enum(brokers.map(broker => broker.value), {
      errorMap: () => ({ message: 'Broker name is required' })
    }),
    port: z
      .number({
        required_error: "Port is required",
        invalid_type_error: "Port must be an number"
      })
      .int()
      .gte(5201)
      .lte(5299),
  });

  const form1 = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      brokerName: null,
      port: null
    },
    validate: zodResolver(schema1),
    validateInputOnBlur: true,
  })

  const schema2 = z.object(getZodSchema(configSchema?.connectionConfig));

  const form2 = useForm({
    mode: 'uncontrolled',
    initialValues: getFormInitialValues(configSchema?.connectionConfig),
    validate: zodResolver(schema2),
    validateInputOnBlur: true,
  })

  const renderSchemaFormFields = (schema, form) => {
    if (!schema) return null;

    return Object.entries(schema).map(([key, value]) => {
      if (value.type === 'string') {
        return (
          <TextInput
            className="mb-2"
            withAsterisk={value.required}
            required={value.required}
            label={value.label}
            placeholder={value.label}
            key={form.key(key)}
            {...form.getInputProps(key)}
          />
        )
      }
    })
  }

  const findClient = async (data) => {
    try {
      setStepError(0);
      setFindingClient(true);
      const { data: configSchema } = await _fetch.get(`/core/resources/live-trading-clients/config-schema?port=${data.port}`);
      if (data.brokerName !== configSchema.brokerName) {
        throw new Error('Client broker mismatch: Verify the broker name.');
      }
      setConfigSchema(configSchema);
      nextStep();
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
      setStepError(1);
    }
    finally {
      setFindingClient(false);
    }
  }

  const configureClient = async (data) => {
    try {
      const step1 = form1.getValues();
      const configData = { ...step1, ...data };
      const { data: config } = await _fetch.post(`/core/resources/live-trading-clients/configure?port=${configData.port}`, configData);
      return config;
    }
    catch(error) {
      throw error;
    }
  }

  const authenticate = async (code) => {
    try {
      const step1 = form1.getValues();
      const configData = { ...step1 };
      const { message } = await _fetch.post(`/core/resources/live-trading-clients/authenticate?port=${configData.port}`, { code });
      notifications.show(buildNotificationSuccess(message, 'api'));
    }
    catch(error) {
      throw error;
    }
  }

  const connect = async (data) => {
    try {
      setStepError(0);
      setConnecting(true);
      const config = await configureClient(data);
      window.open(config.devAuthURL, '_blank');
      const code = await getCode();
      await authenticate(code);
      nextStep();
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
      setStepError(2);
    }
    finally {
      setConnecting(false);
    }
  }

  const addClient = async () => {
    try {
      setStepError(0);
      setAddingClient(true);
      const step1 = form1.getValues();
      const step2 = form2.getValues();
      const clientData = {
        ...step1,
        config: step2
      }

      const { message } = await _fetch.post('/core/live-trading-clients', clientData);
      notifications.show(buildNotificationSuccess(message, 'api'));
      nextStep();
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
      setStepError(3);
    }
    finally {
      setAddingClient(false);
    }
  }

  return (
    <Page className="2xl:w-1/2 xl:w-3/4">
      <Link to="/settings" className="flex items-center w-fit pr-3 py-1 mb-4 rounded-md hover:bg-gray-100">
        <ChevronLeftIcon />
        <UnstyledButton>
          Back to Settings
        </UnstyledButton>
      </Link>
      <h1 className="text-3xl font-semibold mb-8">Add Live Trading Client</h1>
      <div className="p-4">
        <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 1 })}
            label="Find Client"
            description="by http port"
            loading={findingClient}
            color={stepError === 1 ? 'red' : undefined}
            icon={stepError === 1 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <form onSubmit={form1.onSubmit(findClient)}>
              <TextInput
                className="mb-2"
                withAsterisk
                required
                label="Live Trading Client Name"
                placeholder="Name"
                key={form1.key('name')}
                {...form1.getInputProps('name')}
              />
              <Select
                className="mb-2"
                withAsterisk
                required
                label="Broker Name"
                placeholder="Broker Name"
                data={brokers}
                allowDeselect={true}
                key={form1.key('brokerName')}
                {...form1.getInputProps('brokerName')}
              />
              <NumberInput
                className="mb-2"
                withAsterisk
                required
                label="HTTP Port"
                description="Enter the http port number on which the client is running"
                placeholder="Don't enter more than 5216 and less than 5201"
                min={5201}
                max={5216}
                key={form1.key('port')}
                {...form1.getInputProps('port')}
              />
              <Group className="mt-6 justify-end">
                <Button className="px-8" type="submit">
                  Find
                </Button>
              </Group>
            </form>
          </Stepper.Step>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 2 })}
            label="Connect"
            description="to brokerage API"
            loading={connecting}
            color={stepError === 2 ? 'red' : undefined}
            icon={stepError === 2 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <form onSubmit={form2.onSubmit(connect)}>
              { renderSchemaFormFields(configSchema?.connectionConfig, form2) }
              <Group className="mt-6 justify-end">
                <Button className="px-8" onClick={prevStep} disabled={connecting}>
                  Back
                </Button>
                <Button className="px-8" type="submit" disabled={connecting}>
                  Connect
                </Button>
              </Group>
            </form>
          </Stepper.Step>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 3 })}
            label="Add Client"
            description="into the system"
            loading={addingClient}
            color={stepError === 3 ? 'red' : undefined}
            icon={stepError === 3 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <form onSubmit={form1.onSubmit(addClient)}>
              Create live trading client by clicking on Create button.
              <Group className="mt-6 justify-end">
                <Button className="px-8" onClick={prevStep}>
                  Back
                </Button>
                <Button className="px-8" type="submit">
                  Create
                </Button>
              </Group>
            </form>
          </Stepper.Step>
          <Stepper.Completed>
            Live trading client was successfully created!
          </Stepper.Completed>
        </Stepper>
      </div>
    </Page>
  )
}

export default AddLiveTradingClient;