import { useState } from 'react';

import {
  TextInput,
  Select,
  Textarea,
  Button,
  Title,
  Group
} from '@mantine/core';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useForm } from '@mantine/form';
import { useUIConfigSelector } from '@/context/uiConfig';
import { getBrokersListByAccountType } from '@/lib/utils';

function NewAccountForm({ close, submit }) {

  const accountTypes = useUIConfigSelector('dropdown_options', 'account_types');
  const brokers = useUIConfigSelector('dropdown_options', 'brokers');

  const [brokersList, setBrokersList] = useState(getBrokersListByAccountType(brokers, 'livetrading'));

  const schema = z.object({
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
  })

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      type: 'livetrading',
      description: null,
      brokerName: null,
      accountNumber: null
    },
    validate: zodResolver(schema),
    validateInputOnBlur: true,
    transformValues: values => ({
      ...values,
      description: values.description ? values.description : null,
      brokerName: values.brokerName ? values.brokerName : null,
      accountNumber: values.accountNumber ? values.accountNumber : null
    }),
  })

  form.watch('type', ({ previousValue, value }) => {
    if (previousValue !== value) {
      setBrokersList(getBrokersListByAccountType(brokers, value));
      form.setFieldValue('brokerName', null);
    }
  })

  return (
    <div className="p-4">
      <Title className="mb-4 text-3xl">
        Create new account
      </Title>
      <form onSubmit={form.onSubmit(submit)}>
        <TextInput
          className="mb-2"
          withAsterisk
          required
          label="Account Name"
          placeholder="Account Name"
          key={form.key('name')}
          {...form.getInputProps('name')}
        />
        <Select
          className="mb-2"
          withAsterisk
          required
          label="Account Type"
          placeholder="Account Type"
          data={accountTypes}
          allowDeselect={false}
          key={form.key('type')}
          {...form.getInputProps('type')}
        />
        <Textarea
          className="mb-2"
          placeholder="Description..."
          label="Account Description"
          autosize
          minRows={2}
          radius="sm"
          key={form.key('description')}
          {...form.getInputProps('description')}
        />
        <Select
          className="mb-2"
          withAsterisk
          required
          label="Broker Name"
          placeholder="Broker Name"
          data={brokersList}
          allowDeselect={true}
          key={form.key('brokerName')}
          {...form.getInputProps('brokerName')}
        />
        <TextInput
          className="mb-2"
          withAsterisk
          required
          label="Account Number"
          placeholder="Account Number"
          key={form.key('accountNumber')}
          {...form.getInputProps('accountNumber')}
        />
        <Group className="mt-6 justify-between">
          <Button variant="transparent" className="px-8" onClick={close}>
            Cancel
          </Button>
          <Button className="px-8" type="submit">
            Create
          </Button>
        </Group>
      </form>
    </div>
  )
}

export default NewAccountForm;