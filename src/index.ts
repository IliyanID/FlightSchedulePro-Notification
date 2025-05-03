// src/handler.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import dayjs from 'dayjs';
import { findOverlaps } from './findOverlaps'
import { ApiResponseSchema } from './schemas';

interface Credentials {
  username: string;
  password: string;
  rememberMe: 'off';
  uv_login: '0';
  uv_ssl: '0';
  zenDeskLogin: '0';
  return: string;
  returnUrl: string;
  checkEmail: 'false';
}

export const handler = async (): Promise<void> => {
  const startDate = dayjs();
  const endDate = startDate.add(14,'day')

  const start = startDate.format('YYYY-MM-DD')
  const end = endDate.format('YYYY-MM-DD')


  const secretArn = process.env.SECRET_ARN!;
  const username = process.env.EMAIL!;
  const topicArn = process.env.ALERT_TOPIC_ARN!;

  const secretsClient = new SecretsManagerClient({});
  const snsClient = new SNSClient({});

  // fetch password from Secrets Manager
  const { SecretString } = await secretsClient.send(new GetSecretValueCommand({
    SecretId: secretArn,
  }));
  const password = SecretString;
  if (!password) {
    throw new Error(`Secret ${secretArn} has no value`);
  }

  const CREDS: Credentials = {
    username,
    password,
    rememberMe: 'off',
    uv_login: '0',
    uv_ssl: '0',
    zenDeskLogin: '0',
    return: '',
    returnUrl: '',
    checkEmail: 'false',
  };

  const LOGIN_URL = 'https://app.flightschedulepro.com/Account/Login/23267';
  const SCHEDULE_URL = 'https://api-external.flightschedulepro.com/api/v2/schedule';

  const jar = new CookieJar();
  const client: AxiosInstance = wrapper(axios.create({ jar, withCredentials: true }));


  
  let scheduleData: any = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const form = new URLSearchParams(CREDS as any as Record<string, string>);
      await client.post(LOGIN_URL, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const cookies = await jar.getCookies(LOGIN_URL);
      const fsp = cookies.find(c => c.key === 'FspApp')?.value;
      if (!fsp) throw new Error("Login failed: 'FspApp' cookie not set");
      const decoded = decodeURIComponent(fsp);
      const parsed = JSON.parse(decoded) as { token: string };
      if (!parsed.token) throw new Error("Login failed: token missing");



      console.log(`Searching from ${start} - ${end}`)

      const payload = {
        operatorId: 23267,
        start,
        end,
        page: 1,
        pageSize: 500,
        includeInstructorTimeOff: true,
        canViewMaintenanceReservations: true,
        outputFormat: 'bryntum',
        layout: 1,
        scheduleViewId: 'V:CD2CF3A8-610D-4C92-A97E-0567D452C65D',
        isCalendarView: false,
        datePickerView: 'day',
        requestTimestamp: Date.now(),
        locationIds: [1503],
        aircraftIds: [],
        aircraftTypeIds: [
          { makeId: 'a9b21bce-746f-4cf2-905c-60ffbb1484ca', modelId: 'cd1567fb-ebc9-4f27-9a8f-d177a53655fa' },
          { makeId: 'a9b21bce-746f-4cf2-905c-60ffbb1484ca', modelId: '8a4b910c-4ac6-4445-998b-6990b5bc1519' },
          { makeId: 'a9b21bce-746f-4cf2-905c-60ffbb1484ca', modelId: '22d0a3a9-6f15-446d-845b-37fc64afd9b5' },
          { makeId: 'a9b21bce-746f-4cf2-905c-60ffbb1484ca', modelId: '8f800298-bede-4749-bfd2-13423599de28' },
        ],
        schedulingGroupIds: [],
        simulatorIds: [],
        instructorIds: ['886d1468-ca50-43e5-ae08-35d7c0f13c9c'],
        equipmentIds: ['00000000-0000-0000-0000-000000000001'],
        meetingRoomIds: ['00000000-0000-0000-0000-000000000001'],
        reservationTypeIds: ['00000000-0000-0000-0000-000000000001'],
        displayMode: 0,
        filterName: 'Def',
        defaultView: false,
        aircraftTab: 'aircraft',
      };

      const resp: AxiosResponse = await client.post(SCHEDULE_URL, payload, {
        headers: {
          Authorization: `Bearer ${parsed.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (resp.status === 200) {
        scheduleData = resp.data;
        break;
      }
      throw new Error(`Bad status: ${resp.status}`);
    } catch {
      if (attempt === 2) {
        await snsClient.send(new PublishCommand({
          TopicArn: topicArn,
          Subject: 'FlightChecker Failure',
          Message: 'MEDIFICORICAL FAILURE: unable to fetch schedule after retry.',
        }));
        return;
      }
    }
  }


  const result = findOverlaps({
    data: ApiResponseSchema.parse(scheduleData),
    minDurHours: 1.5,
    startHour: 9,
    endHour: 17,
    start: startDate,
    end: endDate,
  })
  if(result.length === 0 )return;

  console.log('Sending email!')

  await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: 'Flight Available',
    Message: result.join('\n\n\n'),
  }));
};


export default handler;
