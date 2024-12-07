import {
	IAuthenticateGeneric,
	Icon,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';

export class RedditApplicationOnlyOAuth2Api implements ICredentialType {
	name = 'redditOAuth2ApplicationOnlyApi';
	displayName = 'Reddit Application Only OAuth2 API';
	icon: Icon = 'file:reddit.svg';
	documentationUrl = 'https://github.com/haohanyang/n8n-nodes-userless-reddit#credentials';
	properties: INodeProperties[] = [
		{
			displayName: 'Session Token',
			name: 'sessionToken',
			type: 'hidden',
			typeOptions: {
				expirable: true,
				password: true,
			},
			default: '',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const { access_token } = (await this.helpers.httpRequest({
			method: 'POST',
			url: 'https://www.reddit.com/api/v1/access_token',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': 'n8n',
			},
			auth: {
				username: credentials.clientId as string,
				password: credentials.clientSecret as string,
			},
			body: 'grant_type=client_credentials',
		})) as { access_token: string };

		return {
			sessionToken: access_token,
		};
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.sessionToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://oauth.reddit.com',
			url: '/api/v1/me',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'n8n',
			},
		},
	};
}
