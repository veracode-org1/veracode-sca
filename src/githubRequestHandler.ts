import {getOctokit,context} from '@actions/github';
import { VERACODE_LABEL,SEVERITY_LABELS } from './labels';
import { ReportedLibraryIssue } from './srcclr.d';

const ISSUES_PULL_COUNT = 100;

export class GithubHandler {

    private client:any;

    constructor(private token:string) {
        const baseUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
        this.client = getOctokit(token, { baseUrl });
    }

    public async getVeracodeLabel ()  {
        console.log('getVeracodeLabel - START');
        let veracodeLabel:any = {};
        try {
            
            veracodeLabel = await this.client.rest
                .issues.getLabel({
                    owner:context.repo.owner,
                    repo:context.repo.repo,
                    name:VERACODE_LABEL.name
            });
            console.log('Veracode Labels already exist');
        } catch (e) {
            console.log('=======================   ERROR   ===============================');
            console.log(e);    
        }
        console.log('getVeracodeLabel - END');
        return veracodeLabel;
    }

    public async createVeracodeLabels() {
        console.log('createVeracodeLabels - END');
        try {
            // Creating the severity labels
            for (var label of Object.values(SEVERITY_LABELS)) {
              await this.client.rest.issues.createLabel({
                    owner:context.repo.owner,
                    repo:context.repo.repo,
                    name: label.name,
                    color: label.color,
                    description: label.description
                });
            }
            // Creating the base label
            await this.client.rest.issues.createLabel({
                owner:context.repo.owner,
                repo:context.repo.repo,
                name: VERACODE_LABEL.name,
                color: VERACODE_LABEL.color,
                description: VERACODE_LABEL.description
            });

            //this.client.paginate(this.client.graphql,"");
    
        } catch (e) {
            console.log('=======================   ERROR   ===============================');
            console.log(e);
        }
        console.log('createVeracodeLabels - END');
    }

    public async createIssue(reportedIssue: ReportedLibraryIssue) {
        return await this.client.rest.issues.create({
            owner:context.repo.owner,
            repo:context.repo.repo,
            title:reportedIssue.title,
            body:reportedIssue.description,
            labels: reportedIssue.labels
        });
    }

    public async listExistingOpenIssues() {
        console.log('getIssues - START');
        const query = `query IsslesTitle($organization: String!,$repo: String!, $count: Int!,$label: String!) {
            repository(name: $repo, owner: $organization) {
              issues(first: $count,filterBy: {labels: [$label], states: OPEN}) {
                edges {
                  node {
                    title
                    number
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }`;

        const nextQuery = `query IsslesTitle($organization: String!,$repo: String!, $count: Int!, $endCursor: String!,$label: String!) {
            repository(name: $repo, owner: $organization) {
              issues(first: $count,after: $endCursor,filterBy: {labels: [$label], states: OPEN}) {
                edges {
                  node {
                    title
                    number
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }`;
        
        let issues:Array<{
            node: {
                title: string,
                number: number
            }
        }> = [];
        try {
            let issuesRes: any = await this.client.graphql({
                headers: {
                    authorization: `token ${this.token}`
                },
                query,
                count: ISSUES_PULL_COUNT,
                organization: context.repo.owner,
                repo: context.repo.repo,
                label: VERACODE_LABEL.name
            });
             
            issues = issues.concat(issuesRes.repository.issues.edges);

            while (issuesRes.repository.issues.pageInfo.hasNextPage) {
                console.log('iterating for fetching more related open issues')
                const endCursor =issuesRes.repository.issues.pageInfo.endCursor;

                issuesRes = await this.client.graphql({
                    headers: {
                        authorization: `token ${this.token}`
                    },
                    query:nextQuery,
                    count: ISSUES_PULL_COUNT,
                    endCursor,
                    organization: context.repo.owner,
                    repo: context.repo.repo,
                    label: VERACODE_LABEL.name
                });
                issues = issues.concat(issuesRes.repository.issues.edges);
            }
        } catch (e) {
                console.log('=======================   ERROR   ===============================');
                console.log(e);
        }
        console.log('getIssues - END');
        return issues;
    }
}

