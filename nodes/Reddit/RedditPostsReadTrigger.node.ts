import {
	IHttpRequestOptions,
	NodeOperationError,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

interface PollData {
	lastRedditPostTimestamp?: number;
	lastRedditPostId?: string;
	lastRedditPostSubreddit?: string;
}

interface RedditPost {
	created: number;
	id: string;
	url: string;
}

export class RedditPostsReadTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Reddit Posts Trigger',
		name: 'redditPostTrigger',
		group: ['trigger'],
		icon: 'file:reddit.svg',
		polling: true,
		version: 1,
		description: 'Starts a workflow when new reddit posts published',
		defaults: {
			name: 'Reddit Posts Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'redditOAuth2ApplicationOnlyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Subreddit',
				name: 'subreddit',
				type: 'string',
				default: '',
				placeholder: 'Python',
				description: 'Name of subreddit',
				required: true,
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 10,
				description: 'Max number of results to return',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const pollData = this.getWorkflowStaticData('node') as PollData;

		this.logger.info(
			pollData.lastRedditPostTimestamp ? pollData.lastRedditPostTimestamp.toString() : 'no data',
		);
		this.logger.info(pollData.lastRedditPostId ? pollData.lastRedditPostId : 'no data');
		this.logger.info(
			pollData.lastRedditPostSubreddit ? pollData.lastRedditPostSubreddit : 'no data',
		);

		const subreddit = this.getNodeParameter('subreddit') as string;
		const itemLimit = this.getNodeParameter('limit') as number;

		if (subreddit !== pollData.lastRedditPostSubreddit) {
			pollData.lastRedditPostSubreddit = subreddit;
			pollData.lastRedditPostId = undefined;
			pollData.lastRedditPostTimestamp = undefined;
		}

		const options: IHttpRequestOptions = {
			method: 'GET',
			baseURL: 'https://oauth.reddit.com',
			url: `/r/${subreddit}/new`,
			headers: {
				'User-Agent': 'n8n',
			},
			qs: {
				limit: itemLimit,
			},
			json: true,
		};
		try {
			const responseData = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'redditOAuth2ApplicationOnlyApi',
				options,
			);

			const posts = responseData.data.children
				.filter((c: { kind: string; data: RedditPost }) => c.kind === 't3')
				.map((c: { kind: string; data: RedditPost }) => c.data);

			posts.sort((a: RedditPost, b: RedditPost) => b.created - a.created);

			if (this.getMode() == 'manual') {
				this.logger.info('manual trigger');
				return [this.helpers.returnJsonArray(posts)];
			}

			if (!pollData.lastRedditPostTimestamp) {
				this.logger.info(`init fetch ${pollData.lastRedditPostTimestamp}`);
				if (posts.length > 0) {
					pollData.lastRedditPostTimestamp = posts[0].created;
					pollData.lastRedditPostId = posts[0].id;
					this.logger.info(JSON.stringify(posts.map((e: any) => `${e.id}-${e.created}`)));
					return [this.helpers.returnJsonArray(posts)];
				}
				return null;
			} else {
				const newPosts = posts.filter(
					(p: { created: number; id: string }) => p.created > pollData.lastRedditPostTimestamp!,
				);

				newPosts.sort((a: RedditPost, b: RedditPost) => b.created - a.created);
				if (newPosts.length > 0) {
					pollData.lastRedditPostTimestamp = newPosts[0].created;
					pollData.lastRedditPostId = newPosts[0].id;
					this.logger.info('new posts');
					this.logger.info(JSON.stringify(newPosts.map((e: any) => `${e.id}-${e.created}`)));

					return [this.helpers.returnJsonArray(newPosts)];
				}
				return null;
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error);
		}
	}
}
