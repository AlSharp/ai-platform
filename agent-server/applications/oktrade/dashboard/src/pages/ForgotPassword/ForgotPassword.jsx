import { useState } from "react";
// import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { useAuthFetch } from '@/lib/fetch';

import {
  Paper,
  TextInput,
  PasswordInput,
  Checkbox,
  Button,
  Title,
  Text,
  Anchor,
  Box
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

function ForgotPassword() {

  const navigate = useNavigate();
  const { setToken } = useAuth();
  const _fetch = useAuthFetch();

  return (
    <div>
      forgot password
    </div>
  )
}

export default ForgotPassword;

