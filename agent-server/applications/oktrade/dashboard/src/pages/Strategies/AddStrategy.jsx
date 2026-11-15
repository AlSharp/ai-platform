import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthFetch } from "@/lib/fetch";
import { notifications } from '@mantine/notifications';
import { buildNotificationError, buildNotificationSuccess } from "@/lib/utils";
import Page from '@/layout/Page';

import {
  Group,
  TextInput,
  Select,
  Radio,
  Button,
  UnstyledButton,
  Stepper,
  NumberInput,
  Text
} from '@mantine/core';
import { ChevronLeftIcon, CircleCrossIcon } from '@/components/icons';

import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useForm } from '@mantine/form';
import { useUIConfigSelector } from '@/context/uiConfig';
import { useAppState } from "@/context/appState";

import { cn, getZodSchema, getFormInitialValues } from '@/lib/utils';
import { useGetLocalStorageValue } from '@/lib/hooks';

function AddLiveTradingClient() {
  const _fetch = useAuthFetch();

  const [appState, setAppState] = useAppState();

  const navigate = useNavigate();
  const [activeFrame, setActiveFrame] = useState('strategy_type_selection');
  const [selectedType, setSelectedType] = useState('M');

  const strategyTypes = useUIConfigSelector('dropdown_options', 'strategy_types');
  const strategyFiles = appState.strategyFiles.map(file => ({ label: file.name, value: file.path }))

  const [active, setActive] = useState(0);
  const nextStep = () => {
    setActive((current) => (current < 3 ? current + 1 : current));
  };
  const prevStep = () => {
    setActive((current) => (current > 0 ? current - 1 : current));
    setStepError(0);
  };
  const [stepError, setStepError] = useState(0);

  const [requestingSchema, setRequestingSchema] = useState(false);
  const [configuringStrategy, setConfiguringStrategy] = useState(false);
  const [creatingStrategy, setCreatingStrategy] = useState(false);
  const [configSchema, setConfigSchema] = useState(null);

  const getCode = useGetLocalStorageValue('code', 120000);

  const schema1 = z.object({
    name: z
      .string()
      .min(2, { message: 'Name should have at least 2 characters' })
      .max(30, { message: 'Should be no more than 30 characters' }),
    description: z
      .string()
      .max(255, { message: 'Should be no more than 255 characters' })
      .nullable(),
    type: z
      .enum(strategyTypes.map(type => type.value)),
    file: z
      .enum(strategyFiles.map(file => file.value))
      .nullable(),
    port: z
      .number({
        required_error: "Port is required",
        invalid_type_error: "Port must be an number"
      })
      .int()
      .gte(5217)
      .lte(5232),
    notebookPort: z
      .number({
        required_error: "Port is required",
        invalid_type_error: "Port must be an number"
      })
      .int()
      .gte(5233)
      .lte(5248),
  });

  const form1 = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      description: null,
      type: 'M',
      file: null,
      port: null,
      notebookPort: null
    },
    validate: zodResolver(schema1),
    validateInputOnBlur: true,
    transformValues: values => ({
      ...values,
      description: values.description ? values.description : null,
      file: values.file ? values.file : null,
      port: values.port ? values.port : null,
      notebookPort: values.notebookPort ? values.notebookPort : null,
    })
  })

  const createManualStrategy = async (data) => {
    try {
      setAppState({ screenLoading: true });
      const { message } = await _fetch.post('/core/strategies', { ...data, type: selectedType });
      notifications.show(buildNotificationSuccess(message, 'api', {
        autoClose: 2000,
        onClose: () => navigate('/strategies')
      }));
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
    finally {
      setAppState({ screenLoading: false });
    }
  }

  const schema2 = z.object(getZodSchema(configSchema?.strategyConfig));

  const form2 = useForm({
    mode: 'uncontrolled',
    initialValues: getFormInitialValues(configSchema?.strategyConfig),
    validate: zodResolver(schema2),
    validateInputOnBlur: true,
  })

  const requestSchema = async (data) => {
    try {
      setStepError(0);
      setRequestingSchema(true);
      const requestData = {
        ...data,
        type: selectedType
      }
      console.log('request schema data: ', requestData);
      // 
      nextStep();
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
      setStepError(1);
    }
    finally {
      setRequestingSchema(false);
    }
  }

  const configureStrategy = async (data) => {
    try {
      setStepError(0);
      setConfiguringStrategy(true);
      const step1 = form1.getValues();
      const configData = { ...step1, type: selectedType, config: data };
      console.log('strategy config data: ', configData);
      nextStep();
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
      setStepError(2);
    }
    finally {
      setConfiguringStrategy(false);
    }
  }

  const createAutomatedStrategy = async (data) => {
    try {
      setStepError(0);
      setCreatingStrategy(true);
      const step1 = form1.getValues();
      const step2 = form2.getValues();
      const strategyData = {
        ...step1,
        type: selectedType,
        config: step2
      }
      console.log('create automated strategy data: ', strategyData);
      nextStep();
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
      setStepError(3);
    }
    finally {
      setCreatingStrategy(false);
    }
  }

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

  const renderStrategyTypeSectionFrame = () => {
    if (activeFrame !== 'strategy_type_selection') return null;
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Choose strategy type</h2>
        <Radio.Group
          value={selectedType}
          onChange={setSelectedType}
        >
          <div className="grid gap-4 grid-cols-2">
            <Radio.Card
              className="p-6"
              radius="md"
              value="M"
            >
              <Group wrap="nowrap" align="flex-start">
                <Radio.Indicator />
                <div>
                  <Text className="font-semibold">Manual</Text>
                  <Text>
                    In a manual strategy, you log trades manually, giving you full control over each trade entry. It is ideal for traders who prefer to track their decisions individually. You will still have access to detailed trade journals to review your performance.
                  </Text>
                </div>
              </Group>
            </Radio.Card>
            <Radio.Card
            className="p-6"
              radius="md"
              value="A"
            >
              <Group wrap="nowrap" align="flex-start">
                <Radio.Indicator />
                <div>
                  <Text className="font-semibold">Automated</Text>
                  <Text>
                    An automatic strategy executes trades on your behalf using pre-configured algorithms. While the trades are automated, you will have full access to trade journals for analyzing your strategy's performance and refining future trades.
                  </Text>
                </div>
              </Group>
            </Radio.Card>
          </div>
        </Radio.Group>
        <Group className="mt-6 justify-between">
          <Link to="/strategies">
            <Button variant="transparent" className="px-8">
              Cancel
            </Button>
          </Link>
          <Button className="px-8" onClick={() => setActiveFrame('strategy_configuration')}>
            Next
          </Button>
        </Group>
      </div>
    )
  }

  const renderManualStrategyFrame = () => {
    if (activeFrame !== 'strategy_configuration' || selectedType !== 'M') return null;
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Manual strategy</h2>
        <form onSubmit={form1.onSubmit(createManualStrategy)}>
          <TextInput
            className="mb-2"
            withAsterisk
            required
            label="Strategy Name"
            placeholder="Strategy Name"
            key={form1.key('name')}
            {...form1.getInputProps('name')}
          />
          <TextInput
            className="mb-2"
            withAsterisk
            required
            label="Strategy Description"
            placeholder="Strategy Description"
            key={form1.key('description')}
            {...form1.getInputProps('description')}
          />
          <Group className="mt-6 justify-between">
            <Button variant="transparent" className="px-8" onClick={() => setActiveFrame('strategy_type_selection')}>
              Back
            </Button>
            <Button className="px-8" type="submit">
              Create
            </Button>
          </Group>
        </form>
      </div>
    )
  }

  const renderAutomatedStrategyFrame = () => {
    if (activeFrame !== 'strategy_configuration' || selectedType !== 'A') return null;
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Automated strategy</h2>
        <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 1 })}
            label="Basic info"
            description="Provide name, description, file path, and HTTP ports"
            loading={requestingSchema}
            color={stepError === 1 ? 'red' : undefined}
            icon={stepError === 1 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            <form onSubmit={form1.onSubmit(requestSchema)}>
              <TextInput
                className="mb-2"
                withAsterisk
                required
                label="Strategy Name"
                placeholder="Strategy Name"
                key={form1.key('name')}
                {...form1.getInputProps('name')}
              />
              <TextInput
                className="mb-2"
                withAsterisk
                required
                label="Strategy Description"
                placeholder="Strategy Description"
                key={form1.key('description')}
                {...form1.getInputProps('description')}
              />
              <Select
                className="mb-2"
                label="Strategy File"
                placeholder="Strategy File"
                data={strategyFiles}
                allowDeselect={true}
                key={form1.key('file')}
                {...form1.getInputProps('file')}
              />
              <NumberInput
                className="mb-2"
                withAsterisk
                required
                label="HTTP port of Data Processor"
                description="Receives OHLCV data, sends it to the Jupyter Notebook for analysis, and makes trading decisions based on the results"
                placeholder="Don't enter more than 5232 and less than 5217"
                min={5217}
                max={5232}
                key={form1.key('port')}
                {...form1.getInputProps('port')}
              />
              <NumberInput
                className="mb-2"
                withAsterisk
                required
                label="HTTP Port of Technical Analyzer (Jupyter Notebook)"
                description="Calculates technical indicators from received data and provides results to assist in trading decisions"
                placeholder="Don't enter more than 5248 and less than 5233"
                min={5233}
                max={5248}
                key={form1.key('notebookPort')}
                {...form1.getInputProps('notebookPort')}
              />
              <Group className="mt-6 justify-between">
                <Button variant="transparent" className="px-8" onClick={() => setActiveFrame('strategy_type_selection')}>
                  Cancel
                </Button>
                <Button className="px-8" type="submit">
                  Next
                </Button>
              </Group>
            </form>
          </Stepper.Step>
          <Stepper.Step
            className={cn({'stepper-step-error': stepError === 2 })}
            label="Configure parameters"
            description="Set algorithm parameters from the schema"
            loading={configuringStrategy}
            color={stepError === 2 ? 'red' : undefined}
            icon={stepError === 2 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            Configure parameters
            <form onSubmit={form2.onSubmit(configureStrategy)}>
              { renderSchemaFormFields(configSchema?.strategyConfig, form2) }
              <Group className="mt-6 justify-between">
                <Button variant="transparent" className="px-8" onClick={prevStep}>
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
            label="Review and Save"
            description="Confirm all details before submission"
            loading={creatingStrategy}
            color={stepError === 3 ? 'red' : undefined}
            icon={stepError === 3 ? <CircleCrossIcon className="text-gray-100" /> : null}
          >
            Create automated strategy
            <form onSubmit={form1.onSubmit(createAutomatedStrategy)}>
              <Group className="mt-6 justify-between">
                <Button variant="transparent" className="px-8" onClick={prevStep}>
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
    )
  }

  return (
    <Page className="2xl:w-1/2 xl:w-3/4">
      <Link to="/strategies" className="flex items-center w-fit pr-3 py-1 mb-4 rounded-md hover:bg-gray-100">
        <ChevronLeftIcon />
        <UnstyledButton>
          Back to Strategies
        </UnstyledButton>
      </Link>
      <h1 className="text-3xl font-semibold mb-8">Add Strategy</h1>
      <div>
        { renderStrategyTypeSectionFrame() }
        { renderManualStrategyFrame() }
        { renderAutomatedStrategyFrame() }
      </div>
    </Page>
  )
}

export default AddLiveTradingClient;