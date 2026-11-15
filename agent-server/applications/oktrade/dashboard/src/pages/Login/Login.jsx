import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { useFetch } from '@/lib/fetch';

import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Group
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { buildNotificationError, buildNotificationSuccess } from "@/lib/utils";

function Login() {

  const navigate = useNavigate();
  const { setToken } = useAuth();
  const _fetch = useFetch();

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      username: '',
      password: ''
    }
  })

  const login = async (values) => {
    try {
      const { username, password } = values;
      if (!password || !username) return;
      const { message, data } = await _fetch.post('/login', {
        username,
        password
      });
      const token = data.accessToken;
      notifications.show(buildNotificationSuccess(message));
      localStorage.setItem('token', token);
      setToken(token);
      navigate('/');
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'auth'));
    }
  }

  return (
    <div className="flex w-screen h-full items-center justify-center">
      <Paper className="p-10 border" shadow="lg" radius={5}>
        <Title className="mb-4">
          Welcome back to OKTrade!
        </Title>
        <form onSubmit={form.onSubmit(login)}>
          <TextInput
            className="mb-4"
            withAsterisk
            label="Username"
            placeholder="username"
            key={form.key('username')}
            {...form.getInputProps('username')}
          />
          <PasswordInput
            className="mb-6"
            withAsterisk
            label="Password"
            placeholder="Your password"
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Group className="justify-between">
            <Button className="px-8" type="submit">
              Login
            </Button>
            <Link className="underline text-blue-600 hover:text-blue-800" to="/forgot-password">
                Forgot password?
            </Link>
          </Group>
        </form>
      </Paper>
    </div>
  )
}

export default Login;

